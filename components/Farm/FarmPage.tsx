"use client";

import { useEffect, useMemo, useState } from "react";
import { loadCloudState, saveCloudState } from "../../lib/cloud/client";
import AnimalBuffOptimizer from "./AnimalBuffOptimizer";
import { crops } from "../../lib/gameData";
import type { PriceMap } from "../../lib/market";
import {
  DEFAULT_FARM_PROFILE,
  loadFarmProfile,
  saveFarmProfile,
  loadPublicFarmData,
  loadLiveFarmData,
  type FarmProfile,
  type FarmPublicSnapshot,
  type FarmLiveSnapshot,
  collectibleBonusSummary,
  saveStoredFarmSnapshot,
  loadStoredFarmSnapshot,
} from "../../lib/farm";

type FarmPageProps = {
  prices: PriceMap;
  onOpenOptimizer?: () => void;
};

export default function FarmPage({ prices, onOpenOptimizer }: FarmPageProps) {
  const [profile, setProfile] = useState<FarmProfile>(DEFAULT_FARM_PROFILE);
  const [savedMessage, setSavedMessage] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [farmRoom, setFarmRoom] = useState<"overview" | "crops" | "fruits" | "resources" | "cooking" | "animals" | "inventory" | "boosts" | "collectibles">("overview");

  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState<FarmLiveSnapshot | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");

  const [publicSnapshot, setPublicSnapshot] = useState<FarmPublicSnapshot | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState("");
  const [cloudRestoreMessage, setCloudRestoreMessage] = useState("");
  const [selectedChickenId, setSelectedChickenId] = useState<string | null>(null);
  const [selectedBarnAnimalId, setSelectedBarnAnimalId] = useState<string | null>(null);

  useEffect(() => {
    const localProfile = loadFarmProfile();
    const localSnapshot = loadStoredFarmSnapshot();
    setProfile(localProfile);
    if (localSnapshot?.farmId) {
      setLiveSnapshot(localSnapshot);
      setCloudRestoreMessage("Dados da Fazenda restaurados deste dispositivo.");
    }

    async function restoreFromCloud() {
      try {
        const cloudProfile = await loadCloudState<FarmProfile>("account", "farm_profile");
        const restoredProfile = cloudProfile.data?.landId ? cloudProfile.data : localProfile;
        if (cloudProfile.data?.landId) {
          const saved = saveFarmProfile(cloudProfile.data);
          setProfile(saved);
        }

        const farmId = restoredProfile.landId?.trim();
        if (!farmId) return;

        const cloudSnapshot = await loadCloudState<FarmLiveSnapshot>(farmId, "farm_latest_snapshot");
        if (cloudSnapshot.data?.farmId) {
          setLiveSnapshot(cloudSnapshot.data);
          setCloudRestoreMessage("Dados da Fazenda restaurados da nuvem.");
        }
      } catch {
        // O cache local continua funcionando se a nuvem estiver indisponível.
      }
    }

    void restoreFromCloud();
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!liveSnapshot || !apiKey.trim() || !profile.landId.trim()) return;

    const timer = window.setInterval(() => {
      void loadLiveFarmData(profile.landId, apiKey)
        .then((snapshot) => { setLiveSnapshot(snapshot); saveStoredFarmSnapshot(snapshot); })
        .catch(() => undefined);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [liveSnapshot?.farmId, apiKey, profile.landId]);

  const unlockedCrops = useMemo(
    () => crops.filter((crop) => crop.bumpkinLevel <= profile.bumpkinLevel),
    [profile.bumpkinLevel],
  );

  const pricedUnlockedCrops = useMemo(
    () => unlockedCrops.filter((crop) => prices[crop.name] !== undefined),
    [prices, unlockedCrops],
  );

  const dailyCycles = useMemo(() => {
    if (!unlockedCrops.length) return 0;
    const fastest = Math.min(...unlockedCrops.map((crop) => crop.growTimeSeconds));
    return Math.floor((profile.activeHoursPerDay * 3600) / fastest);
  }, [profile.activeHoursPerDay, unlockedCrops]);

  const liveInventoryPreview = liveSnapshot?.inventory.slice(0, 16) ?? [];
  const liveCropGroups = useMemo(() => {
    const grouped = new Map<string, { name: string; plots: number; amount: number }>();

    for (const crop of liveSnapshot?.crops ?? []) {
      const current = grouped.get(crop.name) ?? { name: crop.name, plots: 0, amount: 0 };
      current.plots += 1;
      current.amount += crop.amount;
      grouped.set(crop.name, current);
    }

    return [...grouped.values()].sort((a, b) => b.plots - a.plots);
  }, [liveSnapshot]);

  function update<K extends keyof FarmProfile>(key: K, value: FarmProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSavedMessage("");
    setLiveSnapshot(null);
  }

  function handleSave() {
    const saved = saveFarmProfile(profile);
    setProfile(saved);
    void saveCloudState("account", "farm_profile", saved);
    setSavedMessage("Perfil salvo no dispositivo e sincronizado com sua conta na nuvem.");
  }

  async function handleLiveLookup() {
    setLiveError("");
    setLiveSnapshot(null);

    if (!profile.landId.trim()) {
      setLiveError("Informe sua Farm ID antes de carregar os dados reais.");
      return;
    }

    if (!apiKey.trim()) {
      setLiveError("Informe sua Farm API Key. Ela fica apenas na memória desta aba.");
      return;
    }

    try {
      setLiveLoading(true);
      const snapshot = await loadLiveFarmData(profile.landId, apiKey);
      setLiveSnapshot(snapshot);
      saveStoredFarmSnapshot(snapshot);
      const profileForCloud = saveFarmProfile({ ...profile, landId: snapshot.farmId });
      setProfile(profileForCloud);
      void saveCloudState("account", "farm_profile", profileForCloud);
      setCloudRestoreMessage("Snapshot atual salvo na nuvem.");

      if (snapshot.summary.cropPlots > 0) {
        setProfile((current) => ({
          ...current,
          cropPlots: snapshot.summary.cropPlots,
        }));
      }
    } catch (error) {
      setLiveError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados reais da fazenda.",
      );
    } finally {
      setLiveLoading(false);
    }
  }

  async function handlePublicLookup() {
    setPublicError("");
    setPublicSnapshot(null);

    if (!profile.landId.trim()) {
      setPublicError("Informe sua Land ID antes de consultar.");
      return;
    }

    try {
      setPublicLoading(true);
      const snapshot = await loadPublicFarmData(profile.landId);
      setPublicSnapshot(snapshot);
    } catch (error) {
      setPublicError(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar os dados públicos.",
      );
    } finally {
      setPublicLoading(false);
    }
  }

  return (
    <div className="farm-page">
      <section className="farm-hero">
        <div>
          <p className="eyebrow">PERFIL DA FAZENDA</p>
          <h2>Minha Fazenda</h2>
          <p>
            Use apenas a Farm ID para o perfil local ou conecte a Farm API Key do próprio
            jogo para carregar dados reais sem conectar sua carteira.
          </p>
        </div>
        <div className="farm-id-card">
          <span>Farm ID</span>
          <strong>{profile.landId || "Não informado"}</strong>
          <small>{liveSnapshot ? "Dados reais carregados" : "Sem conexão de carteira"}</small>
        </div>
      </section>

      {cloudRestoreMessage ? <div className="farm-cloud-restored">☁️ {cloudRestoreMessage}</div> : null}

      <div className="farm-metrics">
        <div className="metric">
          <span>Nível Bumpkin</span>
          <strong>{profile.bumpkinLevel}</strong>
        </div>
        <div className="metric">
          <span>Plots</span>
          <strong>{liveSnapshot?.summary.cropPlots ?? profile.cropPlots}</strong>
        </div>
        <div className="metric">
          <span>Crops plantadas agora</span>
          <strong>{liveSnapshot?.summary.plantedCrops ?? "—"}</strong>
        </div>
        <div className="metric">
          <span>Itens no inventário</span>
          <strong>{liveSnapshot?.summary.inventoryItems ?? "—"}</strong>
        </div>
      </div>

      <div className="farm-grid">
        <section className="panel farm-profile-panel">
          <div className="farm-section-title">
            <div>
              <p className="eyebrow">CONFIGURAÇÃO</p>
              <h2>Perfil local</h2>
            </div>
            <span>Base para recomendações</span>
          </div>

          <div className="farm-form-grid">
            <label>
              Land ID / Farm ID
              <input
                value={profile.landId}
                onChange={(event) => update("landId", event.target.value)}
                placeholder="Ex.: 12345"
                inputMode="numeric"
              />
            </label>

            <label>
              Nível Bumpkin
              <input
                type="number"
                min="1"
                value={profile.bumpkinLevel}
                onChange={(event) =>
                  update("bumpkinLevel", Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>

            <label>
              Plots para crops
              <input
                type="number"
                min="1"
                value={profile.cropPlots}
                onChange={(event) =>
                  update("cropPlots", Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>

            <label>
              Horas ativas por dia
              <input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={profile.activeHoursPerDay}
                onChange={(event) =>
                  update(
                    "activeHoursPerDay",
                    Math.min(24, Math.max(0.5, Number(event.target.value) || 0.5)),
                  )
                }
              />
            </label>
          </div>

          <div className="farm-actions">
            <button type="button" onClick={handleSave}>Salvar perfil</button>
            <button
              type="button"
              className="farm-secondary"
              onClick={() => void handlePublicLookup()}
              disabled={publicLoading}
            >
              {publicLoading ? "Consultando..." : "Consultar camada pública"}
            </button>
            {onOpenOptimizer && (
              <button type="button" className="farm-secondary" onClick={onOpenOptimizer}>
                Abrir Daily Optimizer
              </button>
            )}
          </div>

          {savedMessage && <p className="farm-message">{savedMessage}</p>}
          {publicError && <p className="farm-error">{publicError}</p>}
        </section>

        <section className="panel farm-api-panel">
          <div className="farm-section-title">
            <div>
              <p className="eyebrow">DADOS REAIS</p>
              <h2>Farm API</h2>
            </div>
            <span className="farm-live-badge">Sem wallet</span>
          </div>

          <p className="farm-api-description">
            A Community Farm API do Sunflower Land permite consultar a fazenda usando
            Farm ID + Farm API Key. A chave não é salva no perfil nem no localStorage.
          </p>

          <label className="farm-api-key-label">
            Farm API Key
            <div className="farm-api-key-row">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Cole a chave apenas nesta sessão"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="farm-secondary"
                onClick={() => setShowApiKey((current) => !current)}
              >
                {showApiKey ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          <div className="farm-secret-note">
            <strong>🔐 Segurança</strong>
            <span>
              Pegue a chave dentro do jogo em Settings → ⋯ → Advanced / Developer Options → API Key.
              Não envie essa chave para ninguém e não faça commit dela no GitHub.
            </span>
          </div>

          <div className="farm-actions">
            <button type="button" onClick={() => void handleLiveLookup()} disabled={liveLoading}>
              {liveLoading ? "Carregando fazenda..." : "Carregar dados reais"}
            </button>
            {apiKey && (
              <button type="button" className="farm-secondary" onClick={() => setApiKey("")}>
                Limpar chave
              </button>
            )}
          </div>

          {liveError && <p className="farm-error">{liveError}</p>}
          {liveSnapshot && (
            <p className="farm-message">
              Dados recebidos da Community Farm API às {new Date(liveSnapshot.fetchedAt).toLocaleTimeString()}.
            </p>
          )}
        </section>
      </div>

      {liveSnapshot && (
        <section className="panel farm-live-panel">
          <div className="farm-section-title">
            <div>
              <p className="eyebrow">FAZENDA AO VIVO</p>
              <h2>Farm #{liveSnapshot.farmId}</h2>
            </div>
            <div className="farm-live-heading-actions">
              <span className="farm-live-status">● API conectada</span>
              <button type="button" className="farm-secondary" onClick={() => void handleLiveLookup()} disabled={liveLoading}>
                {liveLoading ? "Atualizando..." : "↻ Atualizar agora"}
              </button>
            </div>
          </div>

          <div className="farm-live-summary">
            <div><span>🌱 Plots</span><strong>{liveSnapshot.summary.cropPlots}</strong></div>
            <div><span>🍎 Fruit patches</span><strong>{liveSnapshot.summary.fruitPatches}</strong></div>
            <div><span>🐔 Galinhas</span><strong>{liveSnapshot.summary.chickens}</strong></div>
            <div><span>🐄 Animais no barn</span><strong>{liveSnapshot.summary.barnAnimals}</strong></div>
            <div><span>🏠 Buildings</span><strong>{liveSnapshot.summary.buildings}</strong></div>
            <div><span>✨ Collectibles colocados</span><strong>{liveSnapshot.summary.collectibles}</strong></div>
          </div>

          {(liveSnapshot.bumpkin.name || liveSnapshot.bumpkin.experience !== undefined) && (
            <div className="farm-live-bumpkin">
              <div>
                <span>Bumpkin</span>
                <strong>{liveSnapshot.bumpkin.name || "Nome não informado pela API"}</strong>
              </div>
              <div>
                <span>Experiência</span>
                <strong>{liveSnapshot.bumpkin.experience ?? "—"}</strong>
              </div>
            </div>
          )}

          <div className="farm-visual-dashboard">
            <div className="farm-visual-heading">
              <div><p className="eyebrow">CENTRAL DA FAZENDA</p><h3>Escolha uma área</h3></div>
              <span>Timers locais + sincronização da API a cada 60s</span>
            </div>

            <div className="farm-room-grid">
              <FarmRoomButton active={farmRoom === "crops"} icon="🌱" title="Crops"
                value={`${liveSnapshot.crops.length} plantadas`} onClick={() => setFarmRoom("crops")} />
              <FarmRoomButton active={farmRoom === "fruits"} icon="🍎" title="Frutas"
                value={`${liveSnapshot.fruits.length} árvores/patches`} onClick={() => setFarmRoom("fruits")} />
              <FarmRoomButton active={farmRoom === "resources"} icon="⛏️" title="Recursos"
                value={`${liveSnapshot.resources.reduce((total, group) => total + group.totalNodes, 0)} presentes`} onClick={() => setFarmRoom("resources")} />
              <FarmRoomButton active={farmRoom === "cooking"} icon="🍳" title="Cozinha"
                value={`${liveSnapshot.productions.length} produções`} onClick={() => setFarmRoom("cooking")} />
              <FarmRoomButton active={farmRoom === "animals"} icon="🐾" title="Animais"
                value={`${liveSnapshot.animals.length} animais`} onClick={() => setFarmRoom("animals")} />
              <FarmRoomButton active={farmRoom === "inventory"} icon="📦" title="Inventário"
                value={`${liveSnapshot.inventory.length} itens`} onClick={() => setFarmRoom("inventory")} />
              <FarmRoomButton active={farmRoom === "boosts"} icon="⚡" title="Boosts"
                value={`${liveSnapshot.boosts.length} detectados`} onClick={() => setFarmRoom("boosts")} />
              <FarmRoomButton active={farmRoom === "collectibles"} icon="✨" title="Collectibles / NFTs"
                value={`${liveSnapshot.collectibles.reduce((n, item) => n + item.count, 0)} colocados`} onClick={() => setFarmRoom("collectibles")} />
            </div>

            {farmRoom !== "overview" && (
              <button type="button" className="farm-room-back" onClick={() => setFarmRoom("overview")}>← Voltar para as casinhas</button>
            )}

            {farmRoom === "overview" && (
              <div className="farm-room-welcome">
                <strong>🏡 Sua Land em áreas</strong>
                <p>Cada casinha abre somente as informações daquela atividade, evitando uma página enorme. Use “Atualizar agora” depois de colher, minerar, cortar ou dar mimo. A Community API pode levar alguns instantes para refletir uma ação recém-feita.</p>
                <small>Última sincronização: {new Date(liveSnapshot.fetchedAt).toLocaleTimeString()}</small>
              </div>
            )}

            {farmRoom === "crops" && (
              <FarmVisualSection title="🌱 Casa das Crops" empty="Nenhuma crop plantada agora.">
                {liveSnapshot.crops.map((crop) => (
                  <FarmTile key={crop.id} icon={cropIcon(crop.name)} title={crop.name} subtitle={`Plot ${crop.id}`}
                    readyAt={crop.readyAt} now={clock} readyLabel="PRONTO PARA COLHER"
                    boostLabels={crop.boostLabels} baseDurationMs={crop.baseDurationMs} effectiveDurationMs={crop.effectiveDurationMs} />
                ))}
              </FarmVisualSection>
            )}

            {farmRoom === "fruits" && (
              <FarmVisualSection title="🍎 Pomar" empty="Nenhum fruit patch foi retornado agora.">
                {liveSnapshot.fruits.map((fruit) => (
                  <div className="farm-resource-wrap" key={fruit.id}>
                    <FarmTile
                      icon={fruitIcon(fruit.name)}
                      title={fruit.name}
                      subtitle={`Patch ${fruit.id}${fruit.harvestsLeft !== undefined ? ` · ${fruit.harvestsLeft} colheita${fruit.harvestsLeft === 1 ? "" : "s"} restante${fruit.harvestsLeft === 1 ? "" : "s"}` : ""}${fruit.status === "empty" ? " · vazio/repondo" : ""}`}
                      readyAt={fruit.readyAt}
                      now={clock}
                      forceReady={fruit.status === "ready"}
                      readyLabel="PRONTA PARA COLHER"
                      boostLabels={fruit.boostLabels}
                      baseDurationMs={fruit.baseDurationMs}
                      effectiveDurationMs={fruit.effectiveDurationMs}
                    />
                    {(fruit.status === "unknown" || fruit.status === "empty") && fruit.diagnosticFields?.length ? (
                      <small className="farm-diagnostic">Campos recebidos: {fruit.diagnosticFields.join(" · ")}</small>
                    ) : null}
                  </div>
                ))}
              </FarmVisualSection>
            )}

            {farmRoom === "resources" && (
              <div className="farm-room-stack">
                {liveSnapshot.resources.filter((g) => g.totalNodes > 0).map((group) => (
                  <FarmVisualSection key={group.key} title={`${resourceIcon(group.key)} ${group.label}`} empty="Nenhum recurso retornado.">
                    {group.nodes.map((node) => (
                      <div className="farm-resource-wrap" key={`${group.key}-${node.id}`}>
                        <FarmTile icon={resourceIcon(group.key)} title={`${group.label} #${node.id}`}
                          subtitle={node.status === "unknown" ? "Timer não identificado pela API" : "Regeneração"}
                          readyAt={node.readyAt} now={clock} forceReady={node.status === "ready"} readyLabel="PRONTO"
                          boostLabels={node.boostLabels} baseDurationMs={node.baseDurationMs} effectiveDurationMs={node.effectiveDurationMs} />
                        {node.status === "unknown" && node.diagnosticFields?.length ? (
                          <small className="farm-diagnostic">Campos recebidos: {node.diagnosticFields.join(" · ")}</small>
                        ) : null}
                      </div>
                    ))}
                  </FarmVisualSection>
                ))}
              </div>
            )}

            {farmRoom === "cooking" && (
              <FarmVisualSection title="🍳 Cozinha e produção" empty="Nenhuma produção em andamento foi detectada.">
                {liveSnapshot.productions.map((job) => (
                  <FarmTile key={job.id} icon="🍲" title={job.item} subtitle={job.building}
                    readyAt={job.readyAt} now={clock} forceReady={job.status === "ready"} readyLabel="PRONTO PARA COLETAR"
                    boostLabels={job.boostLabels} baseDurationMs={job.baseDurationMs} effectiveDurationMs={job.effectiveDurationMs} />
                ))}
              </FarmVisualSection>
            )}

            {farmRoom === "animals" && (
              <div className="farm-room-stack">
                <details className="animal-profit-collapsed"><summary>📊 Análise econômica avançada</summary><AnimalBuffOptimizer animals={liveSnapshot.animals} prices={prices} farmId={liveSnapshot.farmId} /></details>
                <ChickenCoop
                  animals={liveSnapshot.animals}
                  now={clock}
                  farmId={liveSnapshot.farmId}
                  prices={prices}
                  selectedId={selectedChickenId}
                  onSelect={setSelectedChickenId}
                />
                {liveSnapshot.animals.some((animal) => animal.kind !== "Chicken") ? (
                  <AnimalEnclosure
                    animals={liveSnapshot.animals.filter((animal) => animal.kind !== "Chicken")}
                    now={clock}
                    farmId={liveSnapshot.farmId}
                    prices={prices}
                    selectedId={selectedBarnAnimalId}
                    onSelect={setSelectedBarnAnimalId}
                  />
                ) : null}
              </div>
            )}

            {farmRoom === "inventory" && (
              <div className="farm-room-inventory">
                <h3>📦 Inventário completo</h3>
                {liveSnapshot.inventory.length === 0 ? <p>Nenhum inventário foi retornado.</p> : (
                  <div className="farm-inventory-grid">
                    {liveSnapshot.inventory.map((item) => (
                      <div key={item.name}><span>{item.name}</span><strong>{formatAmount(item.amount)}</strong></div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {farmRoom === "collectibles" && (
              <div className="farm-room-inventory">
                <h3>✨ Collectibles / NFTs detectados</h3>
                <p className="caption">Esta lista mostra os collectibles que a Community Farm API informa como colocados na Farm/Home. Ela não representa, por enquanto, todos os NFTs guardados na carteira.</p>
                {liveSnapshot.collectibles.length === 0 ? (
                  <p>Nenhum collectible colocado foi retornado pela API.</p>
                ) : (
                  <div className="farm-collectible-grid">
                    {liveSnapshot.collectibles.map((item) => {
                      const marketPrice = prices[item.name];
                      const areaLabel = item.area === "both" ? "Farm + Home" : item.area === "home" ? "Home" : "Farm";
                      return (
                        <div className={`farm-collectible-card ${item.boostKnown ? "applied" : "pending"}`} key={`${item.area}-${item.name}`} tabIndex={0}>
                          <div className="farm-collectible-card-top">
                            <span className="farm-collectible-icon">✨</span>
                            <span className="farm-collectible-count">{item.count}x</span>
                          </div>
                          <strong title={item.name}>{item.name}</strong>
                          <small>{areaLabel}</small>
                          <div className="farm-collectible-tooltip" role="tooltip">
                            <strong>{item.name}</strong>
                            <span><b>Bônus:</b> {collectibleBonusSummary(item.name)}</span>
                            <span><b>Local:</b> {areaLabel}</span>
                            <span><b>Quantidade:</b> {item.count}x</span>
                            <span><b>Venda instantânea:</b> {marketPrice !== undefined ? `${marketPrice.toFixed(6)} FLOWER` : "Preço ainda não disponível no feed atual"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {farmRoom === "boosts" && (
              <div className="farm-room-inventory">
                <h3>⚡ Boost Engine v1</h3>
                <p className="caption">Somente regras de duração confirmadas são aplicadas. Skills detectadas sem percentual confirmado aparecem como “não aplicada” para evitar timers falsos.</p>
                {liveSnapshot.boosts.length === 0 ? (
                  <p>Nenhum boost de duração conhecido foi detectado no estado atual da Farm API.</p>
                ) : (
                  <div className="farm-boost-list">
                    {liveSnapshot.boosts.map((boost) => (
                      <div className={`farm-boost-row ${boost.applied ? "applied" : "pending"}`} key={`${boost.source}-${boost.name}`}>
                        <div><strong>{boost.name}</strong><small>{boost.source}</small></div>
                        <span>{boost.applied ? "ATIVO NO MOTOR" : "DETECTADO"}</span>
                        {boost.note ? <p>{boost.note}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="farm-live-columns">
            <div className="farm-live-box">
              <h3>🌾 Plantações atuais</h3>
              {liveCropGroups.length === 0 ? (
                <p>Nenhuma crop plantada foi retornada agora.</p>
              ) : (
                <div className="farm-live-list">
                  {liveCropGroups.map((crop) => (
                    <div key={crop.name}>
                      <span>{crop.name}</span>
                      <strong>{crop.plots} plot{crop.plots === 1 ? "" : "s"}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="farm-live-box">
              <h3>⛏️ Recursos</h3>
              <div className="farm-live-list">
                {liveSnapshot.resources.map((resource) => (
                  <div key={resource.key}>
                    <span>{resource.label}</span>
                    <strong>{resource.activeNodes}/{resource.totalNodes}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="farm-live-box">
              <h3>📦 Inventário</h3>
              {liveInventoryPreview.length === 0 ? (
                <p>O endpoint não retornou um bloco de inventário neste formato.</p>
              ) : (
                <div className="farm-live-list farm-inventory-list">
                  {liveInventoryPreview.map((item) => (
                    <div key={item.name}>
                      <span>{item.name}</span>
                      <strong>{formatAmount(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {liveSnapshot.inventory.length > liveInventoryPreview.length && (
                <small>Mostrando 16 de {liveSnapshot.inventory.length} itens com saldo.</small>
              )}
            </div>

            <div className="farm-live-box">
              <h3>📡 Resumo técnico</h3>
              <div className="farm-live-list">
                <div><span>Trades ativos</span><strong>{liveSnapshot.summary.activeTrades}</strong></div>
                <div><span>Seções recebidas</span><strong>{liveSnapshot.rawSections.length}</strong></div>
                <div><span>Fonte</span><strong>Community API</strong></div>
              </div>
            </div>
          </div>

          <p className="caption">
            A Farm API Key foi usada somente para esta requisição. O Sunflower Market Pro não a adiciona ao perfil local.
          </p>
        </section>
      )}

      {!liveSnapshot && (
        <section className="panel farm-readiness-panel">
          <p className="eyebrow">PRONTIDÃO</p>
          <h2>O que já podemos calcular</h2>
          <div className="farm-readiness-list">
            <div><span>🌱</span><div><strong>Crops compatíveis</strong><small>Filtradas pelo nível informado.</small></div></div>
            <div><span>📈</span><div><strong>Receita bruta</strong><small>Com cotações atuais disponíveis no Market.</small></div></div>
            <div><span>⏱️</span><div><strong>Eficiência por hora</strong><small>Usa o tempo cadastrado de crescimento.</small></div></div>
            <div><span>🧠</span><div><strong>Rotina personalizada</strong><small>Considera seus plots e horas ativas por dia.</small></div></div>
          </div>
          <p className="caption">
            Com a crop mais rápida liberada, sua janela ativa comporta até {dailyCycles} ciclos teóricos por plot.
          </p>
        </section>
      )}

      {publicSnapshot && (
        <section className="panel farm-public-panel">
          <div className="farm-section-title">
            <div>
              <p className="eyebrow">CAMADA PÚBLICA</p>
              <h2>Land #{publicSnapshot.landId}</h2>
            </div>
            <span className={`farm-public-status ${publicSnapshot.status}`}>
              {publicSnapshot.status === "partial" ? "Integração parcial" : publicSnapshot.status}
            </span>
          </div>

          <div className="farm-public-grid">
            {publicSnapshot.fields.map((field) => (
              <div className="farm-public-field" key={field.key}>
                <div>
                  <span>{field.label}</span>
                  <strong>{String(field.value ?? "—")}</strong>
                </div>
                <small className={`farm-source-badge ${field.source}`}>
                  {field.source === "onchain" ? "On-chain" : "Público"}
                </small>
                {field.note && <p>{field.note}</p>}
              </div>
            ))}
          </div>

          <div className="farm-public-columns">
            <div>
              <h3>Somente com ID</h3>
              <ul>
                {publicSnapshot.unavailable.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <h3>Observações</h3>
              <ul>
                {publicSnapshot.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function formatAmount(value: number) {
  if (Number.isInteger(value)) return value.toLocaleString("pt-BR");
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}


function FarmRoomButton({ active, icon, title, value, onClick }: { active: boolean; icon: string; title: string; value: string; onClick: () => void }) {
  return (
    <button type="button" className={`farm-room-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="farm-room-icon">{icon}</span>
      <strong>{title}</strong>
      <small>{value}</small>
    </button>
  );
}


function ChickenCoop({ animals, now, farmId, prices, selectedId, onSelect }: {
  animals: FarmLiveSnapshot["animals"];
  now: number;
  farmId: string;
  prices: PriceMap;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const chickens = animals.filter((animal) => animal.kind === "Chicken");
  const selected = chickens.find((animal) => animal.id === selectedId) ?? chickens[0] ?? null;

  useEffect(() => {
    if (!selectedId && chickens[0]) onSelect(chickens[0].id);
  }, [selectedId, chickens.length]);

  if (!chickens.length) {
    return <div className="chicken-coop-empty">Nenhuma galinha foi retornada pela API neste snapshot.</div>;
  }

  const sleeping = chickens.filter((animal) => animal.state === "sleeping").length;
  const attention = chickens.filter((animal) => animal.state === "sick" || animal.state === "needs_attention").length;

  return (
    <section className="chicken-coop-shell">
      <div className="chicken-coop-topbar">
        <div><span className="chicken-coop-mark">🐔</span><div><p className="eyebrow">GALINHEIRO</p><h3>{chickens.length} galinhas detectadas</h3></div></div>
        <div className="chicken-coop-kpis"><span>😴 {sleeping} dormindo</span><span>❤️ {attention} atenção</span></div>
      </div>

      <div className="chicken-coop-layout">
        <div className="chicken-coop-board">
          <div className="coop-prop coop-hay">▦</div>
          <div className="coop-prop coop-bucket">◉</div>
          <div className="coop-chicken-grid">
            {chickens.map((animal) => {
              const isSelected = selected?.id === animal.id;
              const sleepingNow = animal.state === "sleeping";
              const progress = Math.max(12, Math.min(100, animalUiFacts(animal).level ? (animalUiFacts(animal).level! / Math.max(15, animalUiFacts(animal).level!)) * 100 : 35));
              return (
                <button key={animal.id} className={`coop-chicken ${isSelected ? "selected" : ""} ${animal.state}`} onClick={() => onSelect(animal.id)}>
                  <span className="coop-status-icon">{sleepingNow ? "Zz" : animal.state === "sick" ? "!" : animal.state === "needs_attention" ? "♥" : ""}</span>
                  <span className="coop-chicken-icon">🐔</span>
                  <span className="coop-chicken-bottom"><b>{animalUiFacts(animal).level ?? "?"}</b><i><em style={{ width: `${progress}%` }} /></i></span>
                </button>
              );
            })}
          </div>
          <div className="coop-legend"><span>🐔 ativo</span><span>💤 dormindo</span><span>❤️ precisa de atenção</span></div>
        </div>

        {selected ? (
          <aside className="chicken-detail-panel">
            <div className="chicken-detail-title"><span>🐔</span><div><h3>{selected.name || `Chicken #${selected.id}`}</h3><p>Nível {animalUiFacts(selected).level ?? "não identificado"} · {animalStateLabel(selected.state)}</p></div></div>
            <ChickenFact icon="⏱️" label="Estado / próximo ciclo" value={selected.readyAt ? (selected.readyAt <= now ? "Disponível agora" : formatCountdown(selected.readyAt - now)) : animalStateLabel(selected.state)} />
            <ChickenDiagnosticSummary animal={selected} />
            <AnimalProfitAlert animal={selected} farmId={farmId} prices={prices} />
            <AnimalLevelTracker animal={selected} farmId={farmId} />
            <details className="animal-api-mini"><summary>Dados técnicos da API</summary><AnimalApiDiagnostic animal={selected} /></details>
          </aside>
        ) : null}
      </div>
    </section>
  );
}


type ManualAnimalProgress = {
  target: string;
  remaining: string;
  mimo1: string;
  mimo2: string;
  mimo3: string;
  lastMimo?: { label: string; value: number; at: number };
};

const ANIMAL_PROGRESS_LOCAL_KEY = "sfl-animal-manual-progress-v1";

function useAnimalManualProgress(farmId: string) {
  const [progress, setProgress] = useState<Record<string, ManualAnimalProgress>>({});
  useEffect(() => {
    let active = true;
    try {
      const raw = localStorage.getItem(`${ANIMAL_PROGRESS_LOCAL_KEY}:${farmId}`);
      if (raw) setProgress(JSON.parse(raw));
    } catch {}
    if (farmId) {
      void loadCloudState<Record<string, ManualAnimalProgress>>(farmId, "animal_manual_progress").then((cloud) => {
        if (active && cloud.ok && cloud.data && typeof cloud.data === "object") setProgress(cloud.data);
      });
    }
    return () => { active = false; };
  }, [farmId]);
  useEffect(() => {
    if (!farmId || !Object.keys(progress).length) return;
    try { localStorage.setItem(`${ANIMAL_PROGRESS_LOCAL_KEY}:${farmId}`, JSON.stringify(progress)); } catch {}
    const timer = window.setTimeout(() => { void saveCloudState(farmId, "animal_manual_progress", progress); }, 500);
    return () => window.clearTimeout(timer);
  }, [farmId, progress]);
  return [progress, setProgress] as const;
}

function defaultManualProgress(): ManualAnimalProgress {
  return { target: "", remaining: "", mimo1: "", mimo2: "", mimo3: "" };
}

function AnimalLevelTracker({ animal, farmId }: { animal: FarmLiveSnapshot["animals"][number]; farmId: string }) {
  const [all, setAll] = useAnimalManualProgress(farmId);
  const key = `${animal.kind}:${animal.id}`;
  const value = all[key] ?? defaultManualProgress();
  const patch = (partial: Partial<ManualAnimalProgress>) => setAll((current) => ({ ...current, [key]: { ...(current[key] ?? defaultManualProgress()), ...partial } }));
  const facts = animalUiFacts(animal);
  const apiRemaining = facts.nextLevelRemaining;
  const remainingNum = Math.max(0, Number(String(value.remaining).replace(",", ".")) || 0);
  const targetNum = Math.max(0, Number(String(value.target).replace(",", ".")) || 0);
  const displayedRemaining = value.remaining.trim() ? remainingNum : (apiRemaining ?? targetNum);
  const applyMimo = (label: string, raw: string) => {
    const amount = Math.max(0, Number(String(raw).replace(",", ".")) || 0);
    if (!amount) return;
    const base = value.remaining.trim() ? remainingNum : (apiRemaining ?? targetNum);
    patch({ remaining: String(Math.max(0, base - amount)), lastMimo: { label, value: amount, at: Date.now() } });
  };
  return <div className="animal-level-tracker">
    <div className="animal-level-total"><span>🎯 Para o próximo nível</span><strong>{displayedRemaining > 0 ? `${displayedRemaining.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} XP restantes` : apiRemaining === 0 ? "Pronto para subir" : "Informe o total"}</strong></div>
    {apiRemaining === undefined ? <div className="animal-level-inputs"><label>XP total que falta para o próximo nível<input value={value.target} onChange={(e) => patch({ target: e.target.value, remaining: e.target.value })} inputMode="decimal" placeholder="Ex.: 565" /></label></div> : <small className="animal-level-api-source">Valor recebido da API; os mimos registrados abaixo descontam deste total até a próxima atualização.</small>}
    <div className="animal-mimo-box"><div><span>🤗 Registrar mimo</span><small>Escolha o resultado que saiu no jogo. O site desconta do total restante e salva na nuvem.</small></div><div className="animal-mimo-values">{[1, 2, 3].map((index) => { const field = `mimo${index}` as "mimo1" | "mimo2" | "mimo3"; return <label key={field}>Mimo {index}<input value={value[field]} onChange={(e) => patch({ [field]: e.target.value } as Partial<ManualAnimalProgress>)} inputMode="decimal" placeholder="valor" /><button type="button" onClick={() => applyMimo(`Mimo ${index}`, value[field])}>Registrar</button></label>; })}</div>{value.lastMimo ? <small className="animal-last-mimo">Último: {value.lastMimo.label} (-{value.lastMimo.value})</small> : null}</div>
  </div>;
}

function AnimalEnclosure({ animals, now, farmId, prices, selectedId, onSelect }: { animals: FarmLiveSnapshot["animals"]; now: number; farmId: string; prices: PriceMap; selectedId: string | null; onSelect: (id: string | null) => void; }) {
  const selected = animals.find((animal) => animal.id === selectedId) ?? animals[0] ?? null;
  useEffect(() => { if (!selectedId && animals[0]) onSelect(animals[0].id); }, [selectedId, animals.length]);
  if (!animals.length) return null;
  const sleeping = animals.filter((animal) => animal.state === "sleeping").length;
  const attention = animals.filter((animal) => animal.state === "sick" || animal.state === "needs_attention").length;
  const displayKind = (animal: FarmLiveSnapshot["animals"][number]) => animal.kind === "Barn" ? "Cow" : animal.kind;
  const iconFor = (animal: FarmLiveSnapshot["animals"][number]) => displayKind(animal).toLowerCase().includes("sheep") ? "🐑" : "🐄";
  return <section className="chicken-coop-shell barn-enclosure-shell"><div className="chicken-coop-topbar"><div><span className="chicken-coop-mark">🐄</span><div><p className="eyebrow">CURRAL</p><h3>{animals.length} animais detectados</h3></div></div><div className="chicken-coop-kpis"><span>😴 {sleeping} dormindo</span><span>❤️ {attention} atenção</span></div></div><div className="chicken-coop-layout"><div className="chicken-coop-board barn-board"><div className="coop-prop coop-hay">▦</div><div className="coop-prop coop-bucket">◉</div><div className="coop-chicken-grid barn-animal-grid">{animals.map((animal) => <button key={`${animal.kind}-${animal.id}`} className={`coop-chicken barn-animal ${selected?.id === animal.id ? "selected" : ""} ${animal.state}`} onClick={() => onSelect(animal.id)}><span className="coop-status-icon">{animal.state === "sleeping" ? "Zz" : animal.state === "sick" ? "!" : animal.state === "needs_attention" ? "♥" : ""}</span><span className="coop-chicken-icon">{iconFor(animal)}</span><span className="coop-chicken-bottom"><b>{animalUiFacts(animal).level ?? "?"}</b><i><em style={{ width: animalUiFacts(animal).level ? `${Math.max(12, Math.min(100, animalUiFacts(animal).level! / 15 * 100))}%` : "35%" }} /></i></span></button>)}</div><div className="coop-legend"><span>🐄 ativo</span><span>💤 dormindo</span><span>❤️ precisa de atenção</span></div></div>{selected ? <aside className="chicken-detail-panel"><div className="chicken-detail-title"><span>{iconFor(selected)}</span><div><h3>{selected.name || `${displayKind(selected)} #${selected.id}`}</h3><p>Nível {animalUiFacts(selected).level ?? "não identificado"} · {animalStateLabel(selected.state)}</p></div></div><ChickenFact icon="⏱️" label="Estado / próximo ciclo" value={selected.readyAt ? (selected.readyAt <= now ? "Disponível agora" : formatCountdown(selected.readyAt - now)) : animalStateLabel(selected.state)} /><ChickenDiagnosticSummary animal={selected} /><AnimalProfitAlert animal={selected} farmId={farmId} prices={prices} /><AnimalLevelTracker animal={selected} farmId={farmId} /><details className="animal-api-mini"><summary>Dados técnicos da API</summary><AnimalApiDiagnostic animal={selected} /></details></aside> : null}</div></section>;
}

function ChickenFact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="chicken-fact"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

type AnimalProductionFact = { item: string; amount: number; path: string };
type AnimalUiFacts = {
  level?: number;
  xp?: number;
  nextLevelRemaining?: number;
  favouriteFood?: string;
  feedQuantity?: number;
  buffName?: string;
  buffHarvestsRemaining?: number;
  requestName?: string;
  requestXp?: number;
  requestReadyAt?: number;
  productions: AnimalProductionFact[];
};

const COW_XP_LEVELS = [
  { level: 1, start: 120 },
  { level: 2, start: 240 },
  { level: 3, start: 480 },
  { level: 4, start: 720 },
  { level: 5, start: 960 },
  { level: 6, start: 1320 },
  { level: 7, start: 1680 },
  { level: 8, start: 2040 },
  { level: 9, start: 2400 },
  { level: 10, start: 2880 },
  { level: 11, start: 3360 },
  { level: 12, start: 3840 },
  { level: 13, start: 4320 },
  { level: 14, start: 4800 },
  { level: 15, start: 5400 },
] as const;

function deriveAnimalProgress(kind: string, xp?: number) {
  if (xp === undefined || !Number.isFinite(xp)) return {};

  // The Farm API currently exposes cumulative animal experience without a
  // reliable display-level field for every cow. Derive the level from THIS
  // animal's own XP using the published cow progression table.
  if (/cow/i.test(kind)) {
    const index = [...COW_XP_LEVELS].reverse().findIndex((item) => xp >= item.start);

    if (index >= 0) {
      const row = COW_XP_LEVELS[COW_XP_LEVELS.length - 1 - index];
      const next = COW_XP_LEVELS.find((item) => item.level === row.level + 1);
      return {
        level: row.level,
        nextLevelRemaining: next ? Math.max(0, next.start - xp) : 0,
      };
    }

    // A cow below the first listed XP boundary is still a level-1 cow.
    return { level: 1, nextLevelRemaining: Math.max(0, COW_XP_LEVELS[1].start - xp) };
  }

  return {};
}

function animalUiFacts(animal: FarmLiveSnapshot["animals"][number]): AnimalUiFacts {
  const fields = animal.apiDiagnosticFields ?? [];
  const valueOf = (pattern: RegExp, reject?: RegExp) => fields.find((entry) => pattern.test(entry.path) && !(reject?.test(entry.path)));
  const numberValue = (entry?: { value: string }) => {
    if (!entry) return undefined;
    const n = Number(String(entry.value).replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  };
  const levelEntry = valueOf(/(^|\.)(level|animalLevel)$/i);
  const xpEntry = valueOf(/(^|\.)(xp|experience)$/i, /request|reward|next/i);
  const nextEntry = valueOf(/(to|until|remaining|needed|next).*level|level.*(remaining|needed)|xp.*(remaining|needed|next)|experience.*(remaining|needed|next)/i);
  const favoriteEntry = valueOf(/favorite.*food|favourite.*food|preferred.*food/i, /buff|boost|treat/i);
  const feedQtyEntry = valueOf(/(food|feed).*(amount|quantity|required|needed)|(amount|quantity|required|needed).*(food|feed)/i, /buff|boost/i);

  const productionMap = new Map<string, AnimalProductionFact>();
  for (const entry of fields) {
    const match = entry.path.match(/(egg|feather|milk|leather|wool)/i);
    if (!match) continue;
    const amount = numberValue(entry);
    if (amount === undefined || amount < 0) continue;
    const item = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
    const current = productionMap.get(item);
    if (!current || /yield|amount|reward|produce|harvest/i.test(entry.path)) productionMap.set(item, { item, amount, path: entry.path });
  }

  const buffNameEntry = fields.find((entry) => /buff|boost/i.test(entry.path) && /name|item|food|treat|effect/i.test(entry.path) && isNaN(Number(entry.value)))
    ?? fields.find((entry) => /buff|boost|treat/i.test(entry.path) && isNaN(Number(entry.value)));
  const buffRemainingEntry = valueOf(/(buff|boost|treat).*(harvest|round|cycle).*(remaining|left)|(harvest|round|cycle).*(remaining|left).*(buff|boost|treat)/i);
  const requestNameEntry = fields.find((entry) => /request/i.test(entry.path) && /name|item|type/i.test(entry.path) && isNaN(Number(entry.value)))
    ?? fields.find((entry) => /request/i.test(entry.path) && isNaN(Number(entry.value)));
  const requestXpEntry = valueOf(/request.*(xp|experience)|(xp|experience).*request/i);
  const requestReadyEntry = valueOf(/request.*(ready|at|time|next)|next.*request/i);

  // Prefer the animal's own cumulative experience for cows. The API may expose
  // a stale/legacy `level` field, which was overriding the corrected XP table
  // and making the UI look unchanged after deploys.
  const raw = (animal.rawData && typeof animal.rawData === "object") ? (animal.rawData as Record<string, unknown>) : {};
  const rawXp = Number(String(raw.experience ?? raw.xp ?? "").replace(",", "."));
  const xpFromFields = numberValue(xpEntry);
  const xp = Number.isFinite(rawXp) ? rawXp : xpFromFields;
  const rawKind = String(raw.type ?? raw.animalType ?? raw.species ?? raw.kind ?? "");
  const isCow = /cow/i.test(animal.kind) || /cow/i.test(rawKind) || animal.kind === "Barn";
  const derived = deriveAnimalProgress(isCow ? "Cow" : animal.kind, xp);
  return {
    // For cows, cumulative XP is authoritative for display progress.
    // For other animals we keep the API-provided level behaviour.
    level: isCow && derived.level !== undefined ? derived.level : (animal.level ?? numberValue(levelEntry) ?? derived.level),
    xp,
    nextLevelRemaining: isCow && derived.nextLevelRemaining !== undefined ? derived.nextLevelRemaining : (numberValue(nextEntry) ?? derived.nextLevelRemaining),
    favouriteFood: favoriteEntry?.value,
    feedQuantity: numberValue(feedQtyEntry),
    buffName: buffNameEntry?.value,
    buffHarvestsRemaining: numberValue(buffRemainingEntry),
    requestName: requestNameEntry?.value,
    requestXp: numberValue(requestXpEntry),
    requestReadyAt: numberValue(requestReadyEntry),
    productions: [...productionMap.values()],
  };
}

function fmtAnimalNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function ChickenDiagnosticSummary({ animal }: { animal: FarmLiveSnapshot["animals"][number] }) {
  const facts = animalUiFacts(animal);
  return <div className="chicken-summary-facts">
    {facts.productions.length ? <div className="chicken-summary-row"><span>🥛 Produção</span><strong>{facts.productions.map((item) => `${item.item} ×${fmtAnimalNumber(item.amount)}`).join(" · ")}</strong></div> : null}
    {facts.xp !== undefined ? <div className="chicken-summary-row"><span>⚡ XP</span><strong>{fmtAnimalNumber(facts.xp)}{facts.nextLevelRemaining !== undefined ? ` · +${fmtAnimalNumber(facts.nextLevelRemaining)} para o próximo nível` : ""}</strong></div> : null}
    {facts.favouriteFood ? <div className="chicken-summary-row"><span>🌾 Comida favorita</span><strong>{facts.favouriteFood}</strong></div> : null}
    {facts.buffName ? <div className="chicken-summary-row"><span>🍯 Buff ativo</span><strong>{facts.buffName}{facts.buffHarvestsRemaining !== undefined ? ` · ${fmtAnimalNumber(facts.buffHarvestsRemaining)} colheitas restantes` : ""}</strong></div> : null}
    {facts.requestName ? <div className="chicken-summary-row"><span>🪮 Próximo pedido</span><strong>{facts.requestName}{facts.requestXp !== undefined ? ` (+${fmtAnimalNumber(facts.requestXp)} XP)` : ""}</strong></div> : null}
    {!facts.productions.length && facts.xp === undefined && !facts.favouriteFood && !facts.buffName && !facts.requestName ? <p className="chicken-summary-empty">Abra o diagnóstico abaixo para ver os campos que a API enviou.</p> : null}
  </div>;
}

type AnimalProfitSetting = { feedCost: string; saleFee: string };
function AnimalProfitAlert({ animal, farmId, prices }: { animal: FarmLiveSnapshot["animals"][number]; farmId: string; prices: PriceMap }) {
  const facts = animalUiFacts(animal);
  const storageKey = `animal_profit_alert:${animal.kind}:${animal.id}`;
  const [setting, setSetting] = useState<AnimalProfitSetting>({ feedCost: "", saleFee: "7.5" });
  useEffect(() => {
    let active = true;
    void loadCloudState<AnimalProfitSetting>(farmId, storageKey).then((cloud) => {
      if (active && cloud.ok && cloud.data) setSetting(cloud.data);
    });
    return () => { active = false; };
  }, [farmId, storageKey]);
  const patch = (next: Partial<AnimalProfitSetting>) => {
    const merged = { ...setting, ...next };
    setSetting(merged);
    void saveCloudState(farmId, storageKey, merged);
  };
  const findPrice = (name: string) => {
    if (prices[name] !== undefined) return prices[name];
    const key = Object.keys(prices).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    return key ? prices[key] : undefined;
  };
  const gross = facts.productions.reduce((sum, row) => sum + row.amount * (findPrice(row.item) ?? 0), 0);
  const pricedCount = facts.productions.filter((row) => findPrice(row.item) !== undefined).length;
  const fee = Math.max(0, Math.min(100, Number(setting.saleFee.replace(",", ".")) || 0));
  const net = gross * (1 - fee / 100);
  const favoritePrice = facts.favouriteFood ? findPrice(facts.favouriteFood) : undefined;
  const autoFeedCost = facts.feedQuantity !== undefined && favoritePrice !== undefined ? facts.feedQuantity * favoritePrice : undefined;
  const manualFeedCost = Number(setting.feedCost.replace(",", "."));
  const hasManualCost = setting.feedCost.trim() !== "" && Number.isFinite(manualFeedCost);
  const feedCost = autoFeedCost ?? (hasManualCost ? Math.max(0, manualFeedCost) : undefined);
  const profit = feedCost !== undefined ? net - feedCost : undefined;

  return <div className={`animal-profit-alert ${profit === undefined ? "neutral" : profit >= 0 ? "good" : "bad"}`}>
    <div className="animal-profit-alert-head"><span>💰 Vale alimentar?</span>{profit !== undefined ? <strong>{profit >= 0 ? `✅ Lucro +${profit.toFixed(6)}` : `❌ Prejuízo ${profit.toFixed(6)}`} FLOWER</strong> : <strong>Informe o custo</strong>}</div>
    {pricedCount ? <small>Retorno líquido estimado desta produção: <b>{net.toFixed(6)} FLOWER</b>{fee ? ` após ${fee}% de taxa` : ""}.</small> : <small>Ainda não encontrei preço de mercado para a produção detectada.</small>}
    {autoFeedCost !== undefined ? <small>Comida detectada pela API: custo estimado <b>{autoFeedCost.toFixed(6)} FLOWER</b>.</small> : <label>Custo desta alimentação (FLOWER)<input value={setting.feedCost} onChange={(e) => patch({ feedCost: e.target.value })} inputMode="decimal" placeholder="Ex.: 0,012" /></label>}
    <label>Taxa de venda (%)<input value={setting.saleFee} onChange={(e) => patch({ saleFee: e.target.value })} inputMode="decimal" /></label>
    {feedCost !== undefined && pricedCount ? <div className="animal-profit-break">A alimentação pode custar até <b>{net.toFixed(6)} FLOWER</b> para empatar.</div> : null}
  </div>;
}

function AnimalApiDiagnostic({ animal }: { animal: FarmLiveSnapshot["animals"][number] }) {
  const fields = animal.apiDiagnosticFields ?? [];
  const [copied, setCopied] = useState(false);

  const find = (pattern: RegExp) => fields.find((entry) => pattern.test(entry.path));
  const findMany = (pattern: RegExp, limit = 4) => fields.filter((entry) => pattern.test(entry.path)).slice(0, limit);

  const facts = [
    { label: "Nível", entry: find(/(^|\.)level$|animalLevel/i) },
    { label: "XP / experiência", entry: find(/(^|\.)(xp|experience)$|experience|xp/i) },
    { label: "Sono / acorda", entry: find(/sleep|wake|awakeAt|wakesAt/i) },
    { label: "Comida favorita", entry: find(/favorite.*food|favourite.*food|preferred.*food/i) },
    { label: "Alimentação", entry: find(/food|feed|fed|grain|hungry/i) },
    { label: "Produção", entry: find(/egg|feather|wool|milk|leather|yield|produce|reward/i) },
    { label: "Buff / boost", entry: find(/buff|boost|treat/i) },
    { label: "Próxima ação", entry: find(/request|next.*ready|affection|love|pet|brush/i) },
  ].filter((fact) => fact.entry);

  const production = findMany(/egg|feather|wool|milk|leather|yield|produce|reward/i, 10);
  const feeding = findMany(/food|feed|fed|grain|hungry/i, 10);
  const buffs = findMany(/buff|boost|treat|harvests.*remaining/i, 10);
  const rawJson = JSON.stringify(animal.rawData ?? {}, null, 2);

  async function copyRawJson() {
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="animal-api-diagnostic animal-api-diagnostic-embedded">
      <div className="animal-api-diagnostic-body">
        <div className="animal-api-diagnostic-heading">
          <div><strong>🔎 Campos identificados</strong><small>Dados recebidos para este animal.</small></div>
          <button type="button" onClick={copyRawJson}>{copied ? "✓ Copiado" : "📋 Copiar JSON"}</button>
        </div>

        {facts.length > 0 ? (
          <div className="animal-api-facts">
            {facts.map((fact) => (
              <div key={`${fact.label}-${fact.entry!.path}`}>
                <span>{fact.label}</span>
                <strong>{fact.entry!.value}</strong>
                <small>{fact.entry!.path}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="animal-api-empty">Nenhum campo conhecido foi identificado automaticamente neste animal.</p>
        )}

        {(production.length || feeding.length || buffs.length) ? (
          <div className="animal-api-groups">
            {production.length ? <DiagnosticGroup title="🥚 Produção" fields={production} /> : null}
            {feeding.length ? <DiagnosticGroup title="🌾 Alimentação" fields={feeding} /> : null}
            {buffs.length ? <DiagnosticGroup title="⚡ Buffs" fields={buffs} /> : null}
          </div>
        ) : null}

        <details className="animal-api-raw" open>
          <summary>📋 JSON bruto deste animal</summary>
          <pre>{rawJson}</pre>
        </details>
      </div>
    </div>
  );
}

function DiagnosticGroup({ title, fields }: { title: string; fields: Array<{ path: string; value: string }> }) {
  return (
    <div>
      <strong>{title}</strong>
      {fields.map((field) => (
        <span key={`${field.path}-${field.value}`}><code>{field.path}</code> = {field.value}</span>
      ))}
    </div>
  );
}

function FarmVisualSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) && items.length === 0;
  return <div className="farm-visual-section"><h3>{title}</h3><div className="farm-tile-grid">{isEmpty ? <p className="farm-visual-empty">{empty}</p> : items}</div></div>;
}

function FarmTile({ icon, title, subtitle, readyAt, now, forceReady, readyLabel, warning, boostLabels, baseDurationMs, effectiveDurationMs }: { icon: string; title: string; subtitle: string; readyAt?: number; now: number; forceReady?: boolean; readyLabel: string; warning?: boolean; boostLabels?: string[]; baseDurationMs?: number; effectiveDurationMs?: number }) {
  const ready = forceReady || (readyAt !== undefined && readyAt <= now);
  const unknown = readyAt === undefined && !forceReady;
  const saved = baseDurationMs && effectiveDurationMs && effectiveDurationMs < baseDurationMs ? baseDurationMs - effectiveDurationMs : 0;
  return <div className={`farm-tile ${ready ? "ready" : ""} ${warning ? "warning" : ""}`}>
    <div className="farm-tile-image"><span>{icon}</span><div className="farm-tile-timer">{ready ? readyLabel : unknown ? "SEM TIMER" : formatCountdown(readyAt! - now)}</div></div>
    <strong>{title}</strong><small>{subtitle}</small>
    {boostLabels?.length ? <div className="farm-tile-boosts">{boostLabels.map((label) => <span key={label}>⚡ {label}</span>)}</div> : null}
    {saved > 0 ? <small className="farm-time-saved">Economia estimada: {formatCountdown(saved)}</small> : null}
  </div>;
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000)); const d = Math.floor(total / 86400); const h = Math.floor((total % 86400) / 3600); const m = Math.floor((total % 3600) / 60); const sec = total % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function cropIcon(name: string) { const n = name.toLowerCase(); if (n.includes("carrot")) return "🥕"; if (n.includes("potato")) return "🥔"; if (n.includes("corn")) return "🌽"; if (n.includes("pumpkin")) return "🎃"; if (n.includes("wheat") || n.includes("barley")) return "🌾"; if (n.includes("cabbage") || n.includes("kale")) return "🥬"; return "🌱"; }
function fruitIcon(name: string) { const n = name.toLowerCase(); if (n.includes("apple")) return "🍎"; if (n.includes("orange")) return "🍊"; if (n.includes("blueberry")) return "🫐"; if (n.includes("banana")) return "🍌"; if (n.includes("lemon")) return "🍋"; return "🍇"; }
function resourceIcon(key: string) { if (key === "trees") return "🌳"; if (key === "iron") return "⛏️"; if (key === "gold") return "🟡"; if (key === "oilReserves") return "🛢️"; return "🪨"; }
function animalStateLabel(state: string) { return ({ awake: "Acordado", sleeping: "Dormindo", sick: "Doente", needs_attention: "Precisa de atenção", unknown: "Estado não informado" } as Record<string,string>)[state] || state; }
