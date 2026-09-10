import { NextRequest, NextResponse } from "next/server";
import type {
  FarmPublicLookupResponse,
  FarmPublicSnapshot,
} from "../../../../lib/farm/publicData";

const BUMPKIN_ERC721_ADDRESS = "0x624E4fa6980Afcf8EA27BFe08e2fB5979b64DF1C";
const BUMPKIN_DETAILS_ADDRESS = "0x687BcED586A8AECEdA5bd6b142577DE1d83a2a9c";
const BUMPKIN_STATS_ADDRESS = "0xcfA31cBAe3459c780999D12a9e5FdBd8E8588725";

export async function GET(request: NextRequest) {
  const landId = request.nextUrl.searchParams.get("landId")?.trim() ?? "";

  if (!/^\d+$/.test(landId)) {
    return NextResponse.json<FarmPublicLookupResponse>(
      {
        ok: false,
        error: "Land ID inválida. Use apenas números.",
      },
      { status: 400 },
    );
  }

  /*
   * IMPORTANTE:
   * A documentação pública oficial permite consultar estatísticas do Bumpkin
   * on-chain, mas não documenta atualmente um método público estável para
   * resolver diretamente Land ID -> Bumpkin ID / wallet.
   *
   * Por isso esta rota já define o contrato de dados e os endereços oficiais,
   * mas NÃO inventa uma associação entre a Land ID e um Bumpkin.
   * Quando um resolver público confiável for confirmado, ele entra aqui sem
   * precisar alterar FarmPage, Optimizer ou os demais consumidores.
   */

  const snapshot: FarmPublicSnapshot = {
    landId,
    status: "partial",
    provider: "Sunflower Market Pro public farm adapter",
    fetchedAt: Date.now(),
    fields: [
      {
        key: "landId",
        label: "Land ID",
        value: landId,
        source: "public-index",
        note: "Identificador informado pelo usuário.",
      },
      {
        key: "bumpkinContract",
        label: "Bumpkin ERC721",
        value: BUMPKIN_ERC721_ADDRESS,
        source: "onchain",
        note: "Contrato público documentado pelo Sunflower Land.",
      },
      {
        key: "bumpkinDetailsContract",
        label: "Bumpkin Details",
        value: BUMPKIN_DETAILS_ADDRESS,
        source: "onchain",
        note: "Permite consultar wallet e detalhes quando o Bumpkin ID é conhecido.",
      },
      {
        key: "bumpkinStatsContract",
        label: "Bumpkin Statistics",
        value: BUMPKIN_STATS_ADDRESS,
        source: "onchain",
        note: "XP, skills, achievements e analytics são expostos on-chain.",
      },
    ],
    unavailable: [
      "Bumpkin ID resolvido automaticamente somente pela Land ID",
      "Inventário off-chain em tempo real",
      "Plots e plantações atuais",
      "Deliveries atuais",
      "Buffs temporários e timers internos",
    ],
    notes: [
      "A camada on-chain está preparada para receber o resolver Land ID -> Bumpkin assim que houver uma fonte pública estável e permitida.",
      "Dados completos podem ser carregados na aba Farm API usando Farm ID + Farm API Key fornecida dentro do jogo, sem conectar carteira.",
      "A Farm API Key é tratada como segredo e não é persistida no perfil nem em localStorage.",
    ],
  };

  return NextResponse.json<FarmPublicLookupResponse>({
    ok: true,
    snapshot,
  });
}
