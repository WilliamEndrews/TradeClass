# ADR-0014 — Live POV da camera de cinema

- Status: Aceito
- Data: 2026-09-25
- Contexto do produto: Room iso, Create assets, Klimmos Sit

## Contexto

A sala live-trade precisa de uma sensacao de transmissao: o trader (Klimmos)
sentado no desk, TV grande na parede e uma camera de cinema clicavel. O clique
abre um modal com “POV” da live. WebRTC / webcam real nao cabem neste ciclo.

## Decisao

1. **Agora — POV simulado:** modal centrado (~70% da viewport) com fundo da
   TV/tema, Klimmos em pose `Sit`, chrome LIVE (badge, viewers mock, ticker do
   `seriesId`). Props do modal incluem `mode: 'simulated' | 'webrtc_future'`.
2. **Clique:** assets Create `created-cinema-camera` / `created-cinema-camera-pro`
   com `interativo.acao: "live_pov"`. No Lab, Alt+clique abre o drawer; no Room,
   clique simples picka por `assetId` (`SelecaoAlvo.kind: 'camera'`) e abre o
   modal. Sem novo `Prop.kind` — cameras continuam `kind: "lamp"`.
3. **Montagem:** injetor `anexarLiveTradeRoom` (ao lado de wall-media-demo)
   garante desk + laptop, big-tv hybrid e camera (+ stand) na boss_room/private.
4. **Depois (nao implementado):** `mode: 'webrtc_future'` no mesmo modal —
   MediaStream / peer connection. Sem segundo renderer iso “verdadeiro”.

## Consequencias

- Pick e visual da camera Create no iso usam overlay PNG; a planta pode ainda
  blit o projector do tema sob o overlay.
- WebRTC nao muda contratos de selecao nem o slot do modal.
- Video nativo na nest da TV fica para um ciclo leve seguinte.
