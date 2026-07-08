import React, { useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Path } from 'react-konva';
import { useProjectStore } from '../../store/projectStore';
import { ModularComponentNode } from './ModularComponentNode';
import { CablingRenderer } from './CablingRenderer';
import { resolveBrand, BRAND_THEMES } from '../../types/brand';

interface CabinetCanvasProps {
  zoom: number;
  setZoom: (z: number) => void;
  presentationMode: boolean;
}

/**
 * CabinetCanvas — Atelier NF C 15-100 + Mode Présentation Client
 *
 * Renders a photo-realistic electrical distribution cabinet:
 *  - White ABS plastic enclosure with corner mounting screws
 *  - Top terminal blocks: blue (N), green/yellow (PE) with visible screw heads
 *  - Visible metallic DIN rails with bracket slot holes
 *  - Plastic embossing band showing the dominant brand
 *  - CablingRenderer draws peignes, goulottes, wires, earth bar
 *  - ModularComponentNode renders each breaker/diff
 *  - In presentation mode the white façade overlay closes the cabinet
 */
export const CabinetCanvas: React.FC<CabinetCanvasProps> = ({
  zoom,
  setZoom,
  presentationMode
}) => {
  const {
    cabinets,
    activeCabinetId,
    selectedComponentId,
    selectComponent,
    moveComponent,
    addComponent
  } = useProjectStore();

  const activeCabinet = cabinets.find((c) => c.id === activeCabinetId);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const justDroppedRef = useRef(false);

  // Geometry — proportions based on real 35mm DIN modules at 2x scale
  const scalePxPerMm = 2;
  const moduleWidthPx = 17.5 * scalePxPerMm;
  const componentHeight = 110;
  const rowWiringGap = 100; // realistic cabling channel between rails
  const rowSpacing = componentHeight + rowWiringGap;

  // Cabinet vertical zones:
  //   0–10: outer rim / shadow
  //   10–60: top mounting plate with terminal blocks (N / PE)
  //   60–92: brand embossing band
  //   92–112: top spacer (gives a tiny gap before the first rail)
  //   112–(112 + N*rowSpacing - rowWiringGap + componentHeight + 80): rails + bottom area
  const topTerminalBlockEndY = 60;
  const brandBandY = 64;
  const brandBandHeight = 22;
  const paddingX = 50;
  const railX = paddingX;
  const railWidth = activeCabinet ? activeCabinet.modulesPerRow * moduleWidthPx : 18 * moduleWidthPx;
  const cabinetWidth = railWidth + paddingX * 2;
  const topOffset = 112;

  const getRailYPositions = () => {
    if (!activeCabinet) return [];
    return Array.from({ length: activeCabinet.rowsCount }).map(
      (_, i) => topOffset + i * rowSpacing
    );
  };
  const railYPositions = getRailYPositions();

  const getCabinetHeight = () => {
    if (!activeCabinet) return 600;
    return topOffset + activeCabinet.rowsCount * componentHeight
      + (activeCabinet.rowsCount - 1) * rowWiringGap + 110;
  };
  const cabinetHeight = getCabinetHeight();

  // ──────────────────────────────────────────────────────────────────────
  // Drag & Drop + Snapping (unchanged from before)
  // ──────────────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeCabinet || !stageRef.current) return;
    try {
      const dragDataStr = e.dataTransfer.getData('application/react-coffret-component');
      if (!dragDataStr) return;
      const dragData = JSON.parse(dragDataStr);
      const stage = stageRef.current;
      const stageBox = stage.container().getBoundingClientRect();
      const rawX = e.clientX - stageBox.left;
      const rawY = e.clientY - stageBox.top;
      const scale = stage.scaleX();
      const sX = stage.x();
      const sY = stage.y();
      const canvasX = (rawX - sX) / scale;
      const canvasY = (rawY - sY) / scale;
      const yDiffs = railYPositions.map((y) => Math.abs(canvasY - (y + 15)));
      const closestRowIdx = yDiffs.indexOf(Math.min(...yDiffs));
      const relativeX = canvasX - railX;
      const slot = Math.max(0, Math.round(relativeX / moduleWidthPx));
      const ok = addComponent(activeCabinetId, {
        id: 'comp_' + Math.random().toString(36).substr(2, 9),
        type: dragData.type,
        widthModules: dragData.widthModules,
        rowIndex: closestRowIdx,
        properties: dragData.properties
      });
      if (ok) {
        justDroppedRef.current = true;
        window.setTimeout(() => { justDroppedRef.current = false; }, 150);
      }
    } catch (err) {
      console.error("Drop handling failed", err);
    }
  };

  const handleComponentDragEnd = (e: any, compId: string) => {
    if (!activeCabinet) return;
    const node = e.target;
    const dragX = node.x();
    const dragY = node.y();
    const rowIdx = Math.max(
      0,
      Math.min(activeCabinet.rowsCount - 1, Math.round((dragY - topOffset) / rowSpacing))
    );
    const slotIdx = Math.max(
      0,
      Math.min(activeCabinet.modulesPerRow - (node.width() / moduleWidthPx),
        Math.round((dragX - railX) / moduleWidthPx))
    );
    const moved = moveComponent(activeCabinetId, compId, rowIdx, slotIdx);
    const targetRowY = railYPositions[rowIdx] + 15;
    const targetColX = railX + slotIdx * moduleWidthPx;
    node.x(targetColX);
    node.y(targetRowY);
    node.getLayer().batchDraw();
    if (!moved) selectComponent(null);
  };

  // ──────────────────────────────────────────────────────────────────────
  // Helpers used by the visual rendering
  // ──────────────────────────────────────────────────────────────────────
  const dominantBrandId = (() => {
    const counts: Record<string, number> = {};
    activeCabinet?.components.forEach((c) => {
      const b = c.properties.brand || 'legrand';
      counts[b] = (counts[b] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return (sorted[0]?.[0] || 'legrand') as keyof typeof BRAND_THEMES;
  })();
  const brand = resolveBrand(dominantBrandId);

  // Real terminal screws — small chrome circles with cross-head
  const ScrewHead: React.FC<{ x: number; y: number; size?: number }> = ({ x, y, size = 5 }) => (
    <Group listening={false}>
      <Circle
        x={x}
        y={y}
        radius={size}
        fillLinearGradientStartPoint={{ x: -size / 2, y: -size / 2 }}
        fillLinearGradientEndPoint={{ x: size / 2, y: size / 2 }}
        fillLinearGradientColorStops={[0, '#E5E7EB', 0.6, '#9CA3AF', 1, '#4B5563']}
        stroke="#374151"
        strokeWidth={0.4}
        shadowColor="black"
        shadowBlur={0.5}
        shadowOffset={{ x: 0.2, y: 0.3 }}
        shadowOpacity={0.5}
      />
      {/* cross slot */}
      <Line points={[x - size * 0.7, y, x + size * 0.7, y]} stroke="#1F2937" strokeWidth={0.6} />
      <Line points={[x, y - size * 0.7, x, y + size * 0.7]} stroke="#1F2937" strokeWidth={0.6} />
    </Group>
  );

  // Mounting-plate corner screw — bigger chrome phillips
  const MountingScrew: React.FC<{ x: number; y: number }> = ({ x, y }) => (
    <Group listening={false}>
      <Circle x={x} y={y} radius={9}
        fillLinearGradientStartPoint={{ x: -9, y: -9 }}
        fillLinearGradientEndPoint={{ x: 9, y: 9 }}
        fillLinearGradientColorStops={[0, '#FFFFFF', 0.5, '#D1D5DB', 1, '#4B5563']}
        stroke="#1F2937" strokeWidth={0.8}
        shadowColor="black" shadowBlur={2} shadowOffset={{ x: 1, y: 1 }} shadowOpacity={0.6}
      />
      <Line points={[x - 5, y, x + 5, y]} stroke="#0F172A" strokeWidth={1.2} rotation={45} />
      <Line points={[x - 5, y, x + 5, y]} stroke="#0F172A" strokeWidth={1.2} rotation={135} />
    </Group>
  );

  // Terminal block: a colored strip with multiple screw heads and printed terminal labels
  const TerminalBlock: React.FC<{
    x: number; y: number; width: number; color: string; label: string;
    sublabels?: string[];
  }> = ({ x, y, width, color, label, sublabels }) => (
    <Group listening={false}>
      {/* Strip body — colored plastic */}
      <Rect
        x={x} y={y} width={width} height={32}
        fillLinearGradientStartPoint={{ x: 0, y: y }}
        fillLinearGradientEndPoint={{ x: 0, y: y + 32 }}
        fillLinearGradientColorStops={[0, color, 0.7, color, 1, darken(color, 0.15)]}
        stroke="#1F2937" strokeWidth={0.6}
        cornerRadius={2}
        shadowColor="black" shadowBlur={1.5} shadowOffset={{ x: 0, y: 1 }} shadowOpacity={0.35}
      />
      {/* Top edge highlight */}
      <Line points={[x + 1, y + 0.7, x + width - 1, y + 0.7]} stroke="rgba(255,255,255,0.45)" strokeWidth={0.8} />
      {/* Bottom edge shadow */}
      <Line points={[x + 1, y + 31.3, x + width - 1, y + 31.3]} stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} />
      {/* Screw heads — spaced evenly */}
      {Array.from({ length: Math.max(2, Math.floor(width / 22)) }).map((_, i) => {
        const cx = x + 14 + i * 22;
        return <ScrewHead key={`tb-s-${i}`} x={cx} y={y + 14} size={4} />;
      })}
      {/* Functional label printed on the strip */}
      <Text
        x={x + 3} y={y - 8}
        text={label} fontSize={7} fontStyle="bold"
        fill="#1F2937" fontFamily="monospace"
      />
      {sublabels && sublabels.length > 0 && (
        <Group>
          {sublabels.map((sl, i) => (
            <Text
              key={`tb-sl-${i}`}
              x={x + 6 + i * (width / sublabels.length)}
              y={y + 18}
              text={sl}
              fontSize={6} fontStyle="bold"
              fill="rgba(255,255,255,0.9)"
              fontFamily="monospace"
              align="center"
              width={width / sublabels.length - 12}
            />
          ))}
        </Group>
      )}
    </Group>
  );

  // Helper: darken a hex color by a factor (0..1) — used for gradients
  function darken(hex: string, factor: number): string {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m) return hex;
    const [r, g, b] = m.map((h) => parseInt(h, 16));
    const f = (v: number) => Math.max(0, Math.round(v * (1 - factor)));
    return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative h-full w-full overflow-auto flex items-start justify-start transition-all lg:items-center lg:justify-center lg:overflow-hidden ${
        presentationMode
          ? 'bg-gradient-to-tr from-[#141413] via-[#222220] to-[#1e1e1d]'
          : 'bg-[#e5e7eb] bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:16px_16px]'
      }`}
      style={{ touchAction: 'pan-x pan-y' }}
      onClick={() => {
        if (!justDroppedRef.current) selectComponent(null);
      }}
    >
      <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded text-[10px] text-gray-300 font-bold uppercase border border-white/10 z-10">
        Vue : {presentationMode ? 'Façade fermée (Présentation Client)' : 'Atelier câblage (NF C 15-100)'}
      </div>

      <Stage
        ref={stageRef}
        width={cabinetWidth * zoom + 120}
        height={cabinetHeight * zoom + 120}
        scaleX={zoom}
        scaleY={zoom}
        x={60}
        y={30}
        draggable
      >
        <Layer>
          {/* ════════════════════════════════════════════════════════════════
              1. CABINET BACKPLATE — White ABS plastic (real prod look)
              ════════════════════════════════════════════════════════════════ */}
          {/* Subtle drop shadow behind the cabinet */}
          <Rect
            x={10} y={14}
            width={cabinetWidth - 20} height={cabinetHeight - 20}
            fill="#000000" opacity={0.18}
            cornerRadius={6}
            shadowColor="black"
            shadowBlur={28}
            shadowOffset={{ x: 6, y: 12 }}
            shadowOpacity={0.45}
          />
          {/* White ABS enclosure — the back of the open cabinet */}
          <Rect
            x={10} y={10}
            width={cabinetWidth - 20} height={cabinetHeight - 20}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: cabinetHeight - 20 }}
            fillLinearGradientColorStops={[
              0, '#FFFFFF',
              0.4, '#FAFAFA',
              0.7, '#F4F4F1',
              1, '#E8E8E3'
            ]}
            stroke="#C4C4BE"
            strokeWidth={2}
            cornerRadius={6}
          />
          {/* Inner recessed rim — looks like the cabinet backplate is set inside an outer shell */}
          <Rect
            x={18} y={18}
            width={cabinetWidth - 36} height={cabinetHeight - 36}
            fill="#FFFFFF"
            stroke="#E5E5E0"
            strokeWidth={0.8}
            cornerRadius={4}
          />

          {/* ════════════════════════════════════════════════════════════════
              2. MOUNTING-PLATE EDGE SCREWS — visible in all 4 corners
              ════════════════════════════════════════════════════════════════ */}
          <MountingScrew x={26} y={26} />
          <MountingScrew x={cabinetWidth - 26} y={26} />
          <MountingScrew x={26} y={cabinetHeight - 26} />
          <MountingScrew x={cabinetWidth - 26} y={cabinetHeight - 26} />

          {/* ════════════════════════════════════════════════════════════════
              3. TOP TERMINAL BLOCK AREA — blue (N), green/yellow (PE)
                 mirrors the real Legrand/Hager terminal blocks at top
              ════════════════════════════════════════════════════════════════ */}
          {!presentationMode && (
            <Group listening={false}>
              {/* Top phase input terminal block (black) — pre-empts L1/L2/L3 entry */}
              <TerminalBlock
                x={22} y={28} width={cabinetWidth / 2 - 38}
                color="#1F2937"
                label="ARRIVÉE PHASES"
                sublabels={hasAnyThreePhase(activeCabinet) ? ['L1', 'L2', 'L3'] : ['L', 'N']}
              />
              {/* Neutral terminal block (blue) */}
              <TerminalBlock
                x={22 + cabinetWidth / 2 - 22} y={28} width={cabinetWidth / 2 - 60}
                color="#1D4ED8"
                label="NEUTRE (N)"
                sublabels={['N']}
              />
            </Group>
          )}

          {/* ════════════════════════════════════════════════════════════════
              4. BRAND EMBOSSING BAND — printed/embossed brand identity
              ════════════════════════════════════════════════════════════════ */}
          {!presentationMode && (
            <Group listening={false}>
              <Rect
                x={22} y={brandBandY} width={cabinetWidth - 44} height={brandBandHeight}
                fill="#FFFFFF"
                stroke="#D4D4D0"
                strokeWidth={0.6}
                cornerRadius={2}
              />
              {/* brand color stripe on the left */}
              <Rect
                x={22} y={brandBandY} width={6} height={brandBandHeight}
                fill={brand.brandStripeColor}
              />
              <Text
                x={34} y={brandBandY + 3}
                text={brand.fullName.toUpperCase()}
                fontSize={9} fontStyle="bold"
                fill={brand.brandLabelColor}
                fontFamily="Inter, sans-serif"
              />
              <Text
                x={34} y={brandBandY + 12}
                text={`${brand.country} · Coffret de répartition NF C 15-100`}
                fontSize={6.5}
                fill="#64748B"
                fontFamily="Inter, sans-serif"
              />
              {/* Cabinet name on the right */}
              <Text
                x={cabinetWidth / 2} y={brandBandY + 4}
                width={cabinetWidth / 2 - 30}
                text={(activeCabinet?.name || 'Coffret').toUpperCase()}
                fontSize={10} fontStyle="bold" fill="#0F172A"
                align="right"
                fontFamily="Inter, sans-serif"
              />
              <Text
                x={cabinetWidth / 2} y={brandBandY + 13}
                width={cabinetWidth / 2 - 30}
                text={`${activeCabinet?.rowsCount || 0} rangées · ${activeCabinet?.modulesPerRow || 0} modules · IP40`}
                fontSize={6.5}
                fill="#64748B"
                align="right"
                fontFamily="Inter, sans-serif"
              />
            </Group>
          )}

          {/* ════════════════════════════════════════════════════════════════
              5. DIN RAILS — visible metallic rails with bracket holes
              ════════════════════════════════════════════════════════════════ */}
          {!presentationMode && railYPositions.map((y, rIdx) => (
            <Group key={`rail-${rIdx}`} listening={false}>
              {/* Rail metallic body */}
              <Rect
                x={railX - 8} y={y + 35}
                width={railWidth + 16} height={32}
                fillLinearGradientStartPoint={{ x: 0, y: y + 35 }}
                fillLinearGradientEndPoint={{ x: 0, y: y + 67 }}
                fillLinearGradientColorStops={[
                  0, '#A1A1AA', 0.2, '#E4E4E7', 0.45, '#FAFAFA', 0.55, '#F4F4F5', 0.8, '#A1A1AA', 1, '#3F3F46'
                ]}
                stroke="#52525B" strokeWidth={0.5}
                cornerRadius={1}
                shadowColor="black" shadowBlur={2} shadowOffset={{ x: 0, y: 2 }} shadowOpacity={0.25}
              />
              {/* Slot holes along the rail */}
              {Array.from({ length: Math.max(1, Math.floor(railWidth / 30)) }).map((_, i) => (
                <Rect
                  key={`slot-${rIdx}-${i}`}
                  x={railX + i * 30 + 10} y={y + 46}
                  width={12} height={10}
                  fill="#27272A"
                  cornerRadius={1}
                />
              ))}
              {/* End caps */}
              <Rect x={railX - 10} y={y + 33} width={4} height={36} fill="#52525B" cornerRadius={0.5} />
              <Rect x={railX + railWidth + 6} y={y + 33} width={4} height={36} fill="#52525B" cornerRadius={0.5} />
            </Group>
          ))}

          {/* ════════════════════════════════════════════════════════════════
              6. CABLING — peignes, wires, goulottes, earth bar
              ════════════════════════════════════════════════════════════════ */}
          {activeCabinet && (
            <CablingRenderer
              cabinet={activeCabinet}
              railYPositions={railYPositions}
              railWidth={railWidth}
              railX={railX}
              moduleWidthPx={moduleWidthPx}
              componentHeight={componentHeight}
              presentationMode={presentationMode}
            />
          )}

          {/* ════════════════════════════════════════════════════════════════
              7. MODULAR COMPONENTS — placed on rails (atelier only)
              ════════════════════════════════════════════════════════════════ */}
          {activeCabinet && !presentationMode && activeCabinet.components.map((comp) => {
            const rowY = railYPositions[comp.rowIndex] + 15;
            const colX = railX + comp.moduleIndex * moduleWidthPx;
            return (
              <ModularComponentNode
                key={comp.id}
                component={comp}
                x={colX}
                y={rowY}
                height={componentHeight}
                moduleWidthPx={moduleWidthPx}
                isSelected={selectedComponentId === comp.id}
                onSelect={() => selectComponent(comp.id)}
                onDragStart={() => selectComponent(comp.id)}
                onDragEnd={(e) => handleComponentDragEnd(e, comp.id)}
              />
            );
          })}

          {/* ════════════════════════════════════════════════════════════════
              7b. ROW LABEL STRIPS — printed plastic covers above each rail
              Like the "Sécurité / Tableau / Cuisine / Lave-linge" stickers
              in real Legrand/Hager distribution boards. Safety circuits
              (Cuisine, LL, Eau chaude, Sécurité) are highlighted in red.
              ════════════════════════════════════════════════════════════════ */}
          {!presentationMode && railYPositions.map((y, rowIndex) => {
            const rowComponents = activeCabinet?.components.filter((c) => c.rowIndex === rowIndex) || [];
            const SAFETY_KEYWORDS = /sécurité|securite|safety|cuisine|lave-linge|lave linge|chauffe|eau chaude|four|plaque/i;
            return (
              <Group key={`row-labels-${rowIndex}`} listening={false}>
                {rowComponents.map((comp) => {
                  const colX = railX + comp.moduleIndex * moduleWidthPx;
                  const w = comp.widthModules * moduleWidthPx;
                  const labelY = y - 18; // strip sits above the component (in the wiring channel)
                  const isSafety = SAFETY_KEYWORDS.test(comp.properties.name || '');
                  const fillColor = isSafety ? '#B91C1C' : '#FFFFFF';
                  const textColor = isSafety ? '#FFFFFF' : '#0F172A';
                  return (
                    <React.Fragment key={`rl-${comp.id}`}>
                      {/* Label strip background */}
                      <Rect
                        x={colX + 1} y={labelY}
                        width={w - 2} height={14}
                        fill={fillColor}
                        stroke={isSafety ? '#7F1D1D' : '#94A3B8'}
                        strokeWidth={0.5}
                        cornerRadius={1.2}
                        shadowColor="black" shadowBlur={1} shadowOffset={{ x: 0, y: 0.5 }} shadowOpacity={0.25}
                      />
                      {/* Small triangle notch on top-left for plastic-card look */}
                      <Line
                        points={[colX + 2, labelY, colX + 6, labelY - 2]}
                        stroke={isSafety ? '#7F1D1D' : '#94A3B8'} strokeWidth={0.4}
                      />
                      {/* Printed label text */}
                      <Text
                        x={colX + 2} y={labelY + 2.5}
                        width={w - 4}
                        text={comp.properties.name || '—'}
                        fontSize={6.5}
                        fontStyle="bold"
                        fill={textColor}
                        align="center" ellipsis wrap="none"
                        fontFamily="Inter, sans-serif"
                      />
                    </React.Fragment>
                  );
                })}
                {/* Row index badge on the far left (R1, R2, R3, R4) */}
                <Rect
                  x={railX - 32} y={y - 14}
                  width={22} height={12}
                  fill="#1F2937"
                  cornerRadius={1.5}
                  shadowColor="black" shadowBlur={1} shadowOpacity={0.4}
                />
                <Text
                  x={railX - 32} y={y - 11}
                  width={22}
                  text={`R${rowIndex + 1}`}
                  fontSize={7} fontStyle="bold" fill="#FACC15"
                  align="center" fontFamily="monospace"
                />
              </Group>
            );
          })}

          {/* ════════════════════════════════════════════════════════════════
              8. PRESENTATION MODE — white façade with circuit-name strips
              ════════════════════════════════════════════════════════════════ */}
          {presentationMode && activeCabinet && (
            <PresentationFaçade
              activeCabinet={activeCabinet}
              cabinetWidth={cabinetWidth}
              cabinetHeight={cabinetHeight}
              railX={railX}
              railWidth={railWidth}
              railYPositions={railYPositions}
              moduleWidthPx={moduleWidthPx}
              componentHeight={componentHeight}
              selectedComponentId={selectedComponentId}
              selectComponent={selectComponent}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

// Helper: detect if any load uses 3P/4P for terminal block labeling
function hasAnyThreePhase(cabinet?: { components: Array<{ properties: { poles?: string; powerW?: number } }> }): boolean {
  if (!cabinet) return false;
  return cabinet.components.some(
    (c) => (c.properties.poles === '3P' || c.properties.poles === '4P') && (c.properties.powerW || 0) > 0
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PRESENTATION FAÇADE — in presentation mode we draw a white ABS plastic
// cover plate over the cabinet, with peep windows per row that show only
// the breaker fronts, plus printed circuit-label strips below each row.
// ────────────────────────────────────────────────────────────────────────────
const PresentationFaçade: React.FC<{
  activeCabinet: any;
  cabinetWidth: number;
  cabinetHeight: number;
  railX: number;
  railWidth: number;
  railYPositions: number[];
  moduleWidthPx: number;
  componentHeight: number;
  selectedComponentId: string | null;
  selectComponent: (id: string | null) => void;
}> = ({
  activeCabinet,
  cabinetWidth,
  cabinetHeight,
  railX,
  railWidth,
  railYPositions,
  moduleWidthPx,
  componentHeight,
  selectedComponentId,
  selectComponent
}) => {
  return (
    <Group>
      {/* White ABS cover plate */}
      <Rect
        x={20} y={20}
        width={cabinetWidth - 40} height={cabinetHeight - 40}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: cabinetHeight - 40 }}
        fillLinearGradientColorStops={[0, '#FFFFFF', 0.4, '#FFFFFF', 1, '#E5E7EB']}
        stroke="#94A3B8" strokeWidth={1}
        cornerRadius={4}
        shadowColor="black" shadowBlur={6} shadowOffset={{ x: 0, y: 3 }} shadowOpacity={0.3}
      />
      {/* Glossy reflective overlay */}
      <Rect
        x={20} y={20}
        width={cabinetWidth - 40} height={cabinetHeight - 40}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: cabinetWidth - 40, y: cabinetHeight - 40 }}
        fillLinearGradientColorStops={[
          0, 'rgba(255,255,255,0.18)',
          0.35, 'rgba(255,255,255,0.06)',
          0.45, 'rgba(255,255,255,0)',
          1, 'rgba(255,255,255,0)'
        ]}
        listening={false}
      />
      {/* Per-row peep windows with circuit labels */}
      {railYPositions.map((y, rowIndex) => {
        const rowComponents = activeCabinet.components.filter((c: any) => c.rowIndex === rowIndex);
        return (
          <Group key={`pf-row-${rowIndex}`}>
            <Rect
              x={railX} y={y + 15}
              width={railWidth} height={componentHeight}
              fill="#1F2937" stroke="#0F172A" strokeWidth={1.5}
              cornerRadius={2}
              shadowColor="black" shadowBlur={3} shadowOffset={{ x: 0, y: 1 }} shadowOpacity={0.5}
            />
            {rowComponents.map((comp: any) => {
              const colX = railX + comp.moduleIndex * moduleWidthPx;
              return (
                <ModularComponentNode
                  key={comp.id}
                  component={comp}
                  x={colX} y={y + 15}
                  height={componentHeight}
                  moduleWidthPx={moduleWidthPx}
                  isSelected={selectedComponentId === comp.id}
                  onSelect={() => selectComponent(comp.id)}
                  onDragStart={() => {}}
                  onDragEnd={() => {}}
                />
              );
            })}
            {/* Circuit names strip — printed label area below the row */}
            <Rect
              x={railX} y={y + componentHeight + 18}
              width={railWidth} height={22}
              fill="#FFFFFF" stroke="#94A3B8" strokeWidth={0.6}
              cornerRadius={1.5}
            />
            {Array.from({ length: activeCabinet.modulesPerRow + 1 }).map((_, i) => (
              <Line
                key={`tick-${rowIndex}-${i}`}
                points={[
                  railX + i * moduleWidthPx, y + componentHeight + 18,
                  railX + i * moduleWidthPx, y + componentHeight + 40
                ]}
                stroke="#CBD5E1" strokeWidth={0.4}
              />
            ))}
            {rowComponents.map((comp: any) => {
              const labelX = railX + comp.moduleIndex * moduleWidthPx;
              const labelW = comp.widthModules * moduleWidthPx;
              return (
                <Text
                  key={`label-${comp.id}`}
                  x={labelX + 2} y={y + componentHeight + 24}
                  width={labelW - 4}
                  text={comp.properties.name}
                  fontSize={6.5} fontStyle="bold" fill="#475569"
                  align="center" ellipsis wrap="none"
                  fontFamily="Inter, sans-serif"
                />
              );
            })}
          </Group>
        );
      })}
    </Group>
  );
};
