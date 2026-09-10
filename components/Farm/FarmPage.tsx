"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    setProfile(loadFarmProfile());
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
    setSavedMessage("Perfil salvo. Com o banco configurado, os dados operacionais também são sincronizados na nuvem.");
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
              <AnimalBuffOptimizer animals={liveSnapshot.animals} prices={prices} farmId={liveSnapshot.farmId} />
              <FarmVisualSection title="🐾 Casa dos Animais" empty="Nenhum animal foi retornado neste formato.">
                {liveSnapshot.animals.map((animal) => (
                  <div className="farm-animal-wrap" key={`${animal.kind}-${animal.id}`}>
                    <FarmTile icon={animal.kind === "Chicken" ? "🐔" : "🐄"}
                      title={animal.name || `${animal.kind} #${animal.id}`} subtitle={animalStateLabel(animal.state)}
                      readyAt={animal.readyAt} now={clock} forceReady={animal.state === "awake"}
                      readyLabel={animal.state === "sick" ? "PRECISA DE ATENÇÃO" : "ACORDADO"}
                      warning={animal.state === "sick" || animal.state === "needs_attention"} />
                    <div className={`farm-affection ${animal.affectionAt && animal.affectionAt <= clock ? "ready" : ""}`}>
                      <span>🤗 Mimo</span>
                      <strong>{animal.affectionAt ? (animal.affectionAt <= clock ? "DISPONÍVEL" : formatCountdown(animal.affectionAt - clock)) : "Cooldown ainda não mapeado"}</strong>
                    </div>
                    {animal.level !== undefined ? <small className="farm-diagnostic">Nível detectado: {animal.level}</small> : null}
                    <AnimalApiDiagnostic animal={animal} />
                  </div>
                ))}
              </FarmVisualSection>
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

function AnimalApiDiagnostic({ animal }: { animal: FarmLiveSnapshot["animals"][number] }) {
  const fields = animal.apiDiagnosticFields ?? [];

  const find = (pattern: RegExp) => fields.find((entry) => pattern.test(entry.path));
  const findMany = (pattern: RegExp, limit = 4) => fields.filter((entry) => pattern.test(entry.path)).slice(0, limit);

  const facts = [
    { label: "Nível", entry: find(/(^|\.)level$|animalLevel/i) },
    { label: "XP / experiência", entry: find(/(^|\.)(xp|experience)$|experience|xp/i) },
    { label: "Sono / acorda", entry: find(/sleep|wake|awakeAt|wakesAt/i) },
    { label: "Comida favorita", entry: find(/favorite.*food|favourite.*food|preferred.*food/i) },
    { label: "Alimentação", entry: find(/food|feed|fed|grain|hungry/i) },
    { label: "Produção", entry: find(/egg|feather|wool|milk|yield|produce|reward/i) },
    { label: "Buff / boost", entry: find(/buff|boost/i) },
    { label: "Próxima ação", entry: find(/request|next.*ready|affection|love|pet/i) },
  ].filter((fact) => fact.entry);

  const production = findMany(/egg|feather|wool|milk|yield|produce|reward/i, 8);
  const feeding = findMany(/food|feed|fed|grain|hungry/i, 8);
  const buffs = findMany(/buff|boost/i, 8);

  return (
    <details className="animal-api-diagnostic">
      <summary>🔎 Diagnóstico da API</summary>
      <div className="animal-api-diagnostic-body">
        <p>
          Estes são os campos que a Community Farm API realmente enviou para este animal. Ainda não atribuímos significado a campos duvidosos: primeiro verificamos o dado bruto.
        </p>

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

        <details className="animal-api-raw">
          <summary>Ver JSON bruto deste animal</summary>
          <pre>{JSON.stringify(animal.rawData ?? {}, null, 2)}</pre>
        </details>
      </div>
    </details>
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
