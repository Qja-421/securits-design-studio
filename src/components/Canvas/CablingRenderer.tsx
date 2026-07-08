import React from 'react';
import { Group, Line, Rect, Circle, Path, Text } from 'react-konva';
import { ElectricalComponent, Cabinet } from '../../types/electrical';
import { resolveBrand } from '../../types/brand';

// ────────────────────────────────────────────────────────────────────────────
// Wire / cable colors (NF C 15-100 standard)
//   Phase (mono) : brown #8B4513 / historically black
//   Phase (tri)  : brown / black / grey
//   Neutral      : light blue
//   PE           : green / yellow striped
// ────────────────────────────────────────────────────────────────────────────
const WIRE = {
  phaseMono: '#8B4513',
  phaseTri:  '#1F2937',
  neutral:   '#1D4ED8',
  peYellow:  '#FACC15',
  peGreen:   '#22C55E',
  sheath:    '#1F2937'
};

/**
 * Cable bundle label (printed sticker like "3G2.5mm² / 16A · 20m")
 */
const CableLabel: React.FC<{ x: number; y: number; main: string; sub: string }> = ({
  x, y, main, sub
}) => (
  <Group x={x} y={y} listening={false}>
    <Rect
      x={-34} y={-13} width={68} height={26}
      fill="#FFFFFF" stroke="#475569" strokeWidth={0.6}
      cornerRadius={2}
      shadowColor="black" shadowBlur={1.5} shadowOpacity={0.15} shadowOffset={{ x: 0, y: 0.5 }}
    />
    <Text
      x={-34} y={-10.5} width={68}
      text={main} fontSize={9} fontStyle="bold" fill="#1F2937"
      align="center" fontFamily="monospace"
    />
    <Text
      x={-34} y={2} width={68}
      text={sub} fontSize={6.8} fill="#64748B"
      align="center" fontFamily="monospace"
    />
  </Group>
);

/**
 * Terminal designation tag (L1, N, PE, etc.)
 */
const TerminalTag: React.FC<{ x: number; y: number; text: string; tone?: 'phase' | 'neutral' | 'earth' }> = ({
  x, y, text, tone = 'phase'
}) => {
  const palette = {
    phase:   { fill: '#FFFFFF', stroke: '#1F2937', text: '#1F2937' },
    neutral: { fill: '#FFFFFF', stroke: '#1E40AF', text: '#1E40AF' },
    earth:   { fill: '#FFFFFF', stroke: '#166534', text: '#166534' }
  } as const;
  const p = palette[tone];
  return (
    <Group x={x} y={y} listening={false}>
      <Rect
        x={-10} y={-3.6} width={20} height={7.2}
        fill={p.fill} stroke={p.stroke} strokeWidth={0.5}
        cornerRadius={1.5}
      />
      <Text
        x={-10} y={-2.8} width={20}
        text={text} fontSize={5} fontStyle="bold" fill={p.text}
        align="center" fontFamily="monospace"
      />
    </Group>
  );
};

/**
 * Peigne (comb bus bar) — the long metal comb that all breakers in a row
 * clip into at their bottom terminals. Drawn as a series of pin-heads
 * on a horizontal bar — the iconic Hager / Legrand look.
 */
const Peigne: React.FC<{
  x: number; y: number; width: number; color?: string; teethCount?: number;
}> = ({ x, y, width, color = '#1F2937', teethCount = 13 }) => (
  <Group listening={false}>
    {/* Body bar */}
    <Rect
      x={x} y={y} width={width} height={5}
      fillLinearGradientStartPoint={{ x: 0, y: y }}
      fillLinearGradientEndPoint={{ x: 0, y: y + 5 }}
      fillLinearGradientColorStops={[0, '#52525B', 0.4, '#A1A1AA', 1, '#27272A']}
      stroke="#0F172A" strokeWidth={0.4}
      cornerRadius={0.6}
      shadowColor="black" shadowBlur={1.5} shadowOffset={{ x: 0, y: 1 }} shadowOpacity={0.4}
    />
    {/* Pin teeth — one per module slot */}
    {Array.from({ length: teethCount }).map((_, i) => {
      const tx = x + (width / teethCount) * (i + 0.5);
      return (
        <Group key={`peigne-tooth-${i}`}>
          <Rect
            x={tx - 1.2} y={y + 4} width={2.4} height={5}
            fill="#71717A"
            stroke="#27272A" strokeWidth={0.2}
          />
          {/* Pin head */}
          <Circle
            x={tx} y={y + 2.5} radius={1.3}
            fillLinearGradientStartPoint={{ x: -1, y: -1 }}
            fillLinearGradientEndPoint={{ x: 1, y: 1 }}
            fillLinearGradientColorStops={[0, '#D4D4D8', 1, '#52525B']}
            stroke="#0F172A" strokeWidth={0.2}
          />
        </Group>
      );
    })}
  </Group>
);

/**
 * CablingRenderer — Atelier NF C 15-100 photo-realistic wiring
 *
 * Layers, in z-order:
 *   1. Per-row peignes (comb bus bars)
 *   2. Cable entry at top of enclosure
 *   3. Per-component drop wires (phase + neutral from top terminals)
 *   4. Per-load circuit (phase + neutral + earth to goulotte / earth bar)
 *   5. Cable labels per load circuit
 *   6. Earth bar (barre de terre laiton) at the bottom
 *   7. Inter-row connections (gaines inter-rangées)
 */
export const CablingRenderer: React.FC<{
  cabinet: Cabinet;
  railYPositions: number[];
  railWidth: number;
  railX: number;
  moduleWidthPx: number;
  componentHeight: number;
  presentationMode: boolean;
}> = ({
  cabinet, railYPositions, railWidth, railX, moduleWidthPx, componentHeight, presentationMode
}) => {
  if (presentationMode) return null;
  const components = cabinet.components;
  const modulesPerRow = cabinet.modulesPerRow;

  // Earth bar position — right under the last rail
  const earthBarY = railYPositions[railYPositions.length - 1] + componentHeight + 60;
  const peigneY = (rY: number) => rY + componentHeight + 6;

  // Helper: get cable section label
  const getCableMain = (p: ElectricalComponent['properties']): string => {
    const isTri = p.voltageV === 400;
    const conductors = isTri ? (p.poles === '4P' ? 5 : 4) : 3;
    return `${conductors}G${p.cableSectionMm2}mm²`;
  };
  const getCableSub = (p: ElectricalComponent['properties']): string =>
    `${p.ratingA}A · ${p.cableLengthM}m`;
  const getPhaseTag = (p: ElectricalComponent['properties']): string => {
    if (p.voltageV === 400) return p.poles === '4P' ? 'L1/L2/L3/N' : 'L1/L2/L3';
    return 'L1';
  };

  return (
    <Group>
      {/* ════════════════════════════════════════════════════════════════
          0. CABLE ENTRY — top of enclosure, where wires come in
          Renders as a grommet strip with thick wire bundle descending
          ════════════════════════════════════════════════════════════════ */}
      <Group listening={false}>
        {/* Entry grommet */}
        <Rect
          x={railX - 10} y={28}
          width={railWidth + 20} height={6}
          fill="#1F2937"
          cornerRadius={1}
        />
        {/* Wire bundle descending into the cabinet (visualised as a thick gray sheath) */}
        {(() => {
          const entryY = 34;
          const midX = railX + railWidth / 2;
          return (
            <Group>
              {/* Phase sheaths */}
              <Path
                data={`M ${railX + 30} ${entryY} L ${railX + 30} ${railYPositions[0] - 5}`}
                stroke={WIRE.sheath} strokeWidth={7} lineCap="round" opacity={0.85}
              />
              <Path
                data={`M ${railX + 30} ${entryY} L ${railX + 30} ${railYPositions[0] - 5}`}
                stroke={WIRE.phaseMono} strokeWidth={5} lineCap="round"
              />
              {/* Neutral sheath */}
              <Path
                data={`M ${railX + railWidth - 30} ${entryY} L ${railX + railWidth - 30} ${railYPositions[0] - 5}`}
                stroke={WIRE.sheath} strokeWidth={6} lineCap="round" opacity={0.85}
              />
              <Path
                data={`M ${railX + railWidth - 30} ${entryY} L ${railX + railWidth - 30} ${railYPositions[0] - 5}`}
                stroke={WIRE.neutral} strokeWidth={4} lineCap="round"
              />
              {/* PE sheath */}
              <Path
                data={`M ${midX} ${entryY} L ${midX} ${earthBarY - 5}`}
                stroke={WIRE.sheath} strokeWidth={5} lineCap="round" opacity={0.85}
              />
              <Path
                data={`M ${midX} ${entryY} L ${midX} ${earthBarY - 5}`}
                stroke={WIRE.peYellow} strokeWidth={3} lineCap="round"
              />
              <Path
                data={`M ${midX} ${entryY} L ${midX} ${earthBarY - 5}`}
                stroke={WIRE.peGreen} strokeWidth={2.4} lineCap="round" dash={[5, 3]}
              />
            </Group>
          );
        })()}
      </Group>

      {/* ════════════════════════════════════════════════════════════════
          1. PEIGNES — comb bus bar at the bottom of each row
          ════════════════════════════════════════════════════════════════ */}
      {railYPositions.map((rY, rowIndex) => {
        const rowComponents = components.filter((c) => c.rowIndex === rowIndex);
        if (rowComponents.length === 0) return null;
        return (
          <Peigne
            key={`peigne-${rowIndex}`}
            x={railX}
            y={peigneY(rY)}
            width={railWidth}
            teethCount={modulesPerRow}
          />
        );
      })}

      {/* ════════════════════════════════════════════════════════════════
          2. PER-COMPONENT DROP WIRES — top terminal to bus bar / peigne
          (phase + neutral curves from top to bottom of component)
          ════════════════════════════════════════════════════════════════ */}
      {components.map((c) => {
        if (c.type === 'load') return null;
        const rY = railYPositions[c.rowIndex];
        const xMid = railX + (c.moduleIndex + c.widthModules / 2) * moduleWidthPx;
        const isTri = c.properties.voltageV === 400;
        const phaseColor = isTri ? WIRE.phaseTri : WIRE.phaseMono;
        const phaseTag = getPhaseTag(c.properties);

        return (
          <Group key={`drop-${c.id}`} listening={false}>
            {/* Phase wire — from top terminal down to peigne */}
            <Path
              data={`M ${xMid + 3} ${rY + 13} L ${xMid + 3} ${peigneY(rY) + 2.5}`}
              stroke={phaseColor} strokeWidth={2.2} lineCap="round"
            />
            {/* Neutral wire */}
            <Path
              data={`M ${xMid - 3} ${rY + 13} L ${xMid - 3} ${peigneY(rY) + 2.5}`}
              stroke={WIRE.neutral} strokeWidth={2.2} lineCap="round"
            />
            <TerminalTag x={xMid + 8} y={rY + 14} text={phaseTag} tone="phase" />
            <TerminalTag x={xMid - 8} y={rY + 14} text="N" tone="neutral" />
          </Group>
        );
      })}

      {/* ════════════════════════════════════════════════════════════════
          3. LOAD CIRCUITS — wires from peigne bottom to vertical PE gutter
          Each load shows: phase + neutral descending into the horizontal
          goulotte, earth wire routed cleanly down a dedicated vertical
          gutter on the side of the row to the earth bar.
          ════════════════════════════════════════════════════════════════ */}
      {(() => {
        // Phase wires through horizontal goulotte (per row)
        const lastRowIndex = railYPositions.length - 1;
        return railYPositions.map((rY, rowIndex) => {
          const rowLoads = components.filter((c) => c.rowIndex === rowIndex && c.type === 'load');
          if (rowLoads.length === 0) return null;
          const peigneBottom = peigneY(rY) + 9;
          const goulotteTop = peigneBottom + 4;
          const goulotteHeight = 12;
          // Vertical PE gutter runs on the LEFT of the row, from peigneBottom
          // straight down to the earth bar (or to the next row's gutter).
          const peGutterX = railX - 8;
          const peGutterBottomY = rowIndex < lastRowIndex
            ? railYPositions[rowIndex + 1] + 6
            : earthBarY - 5;

          return (
            <Group key={`row-wires-${rowIndex}`} listening={false}>
              {/* Horizontal goulotte just under the peigne */}
              <Rect
                x={railX - 8} y={goulotteTop}
                width={railWidth + 16} height={goulotteHeight}
                fillLinearGradientStartPoint={{ x: 0, y: goulotteTop }}
                fillLinearGradientEndPoint={{ x: 0, y: goulotteTop + goulotteHeight }}
                fillLinearGradientColorStops={[0, '#E5E7EB', 0.5, '#F3F4F6', 1, '#9CA3AF']}
                stroke="#4B5563" strokeWidth={0.6}
                cornerRadius={1.5}
                shadowColor="black" shadowBlur={1.5} shadowOffset={{ x: 0, y: 1 }} shadowOpacity={0.35}
              />
              <Rect
                x={railX - 4} y={goulotteTop + goulotteHeight / 2 - 1.5}
                width={railWidth + 8} height={3}
                fill="#0F172A"
                cornerRadius={0.6}
              />
              {/* Vertical PE gutter (col de cygne descente à la terre) */}
              <Rect
                x={peGutterX - 4} y={goulotteTop}
                width={8} height={peGutterBottomY - goulotteTop}
                fill="#1F2937"
                cornerRadius={1}
                shadowColor="black" shadowBlur={1} shadowOpacity={0.4}
              />
              {/* Yellow stripe down the gutter */}
              <Rect
                x={peGutterX - 4} y={goulotteTop}
                width={8} height={peGutterBottomY - goulotteTop}
                fill="#FACC15"
                opacity={0.6}
              />
              {/* Green stripe dash on top */}
              <Rect
                x={peGutterX - 4} y={goulotteTop}
                width={8} height={peGutterBottomY - goulotteTop}
                fill="#22C55E"
                opacity={0.5}
                dash={[4, 3]}
              />
              {/* "PE" label on the gutter */}
              <Text
                x={peGutterX - 12} y={(goulotteTop + peGutterBottomY) / 2 - 3}
                text="PE"
                fontSize={6} fontStyle="bold" fill="#15803D"
                fontFamily="monospace"
              />

              {/* Per-load wires + labels */}
              {rowLoads.map((c) => {
                const colX = railX + c.moduleIndex * moduleWidthPx;
                const w = c.widthModules * moduleWidthPx;
                const xMid = colX + w / 2;
                const topY = rY + 13;
                const props = c.properties;
                const isTri = props.voltageV === 400;
                const phaseColor = isTri ? WIRE.phaseTri : WIRE.phaseMono;
                const labelFontSize = Math.min(6.5, Math.max(4.5, w / 6));

                return (
                  <Group key={`load-${c.id}`} listening={false}>
                    {/* Phase: top -> peigne -> goulotte */}
                    <Path
                      data={`M ${xMid} ${topY} L ${xMid} ${peigneBottom} L ${xMid} ${goulotteTop + 2}`}
                      stroke={phaseColor} strokeWidth={2.2} lineCap="round"
                    />
                    {/* Neutral: top -> peigne -> goulotte */}
                    <Path
                      data={`M ${xMid - 4} ${topY} L ${xMid - 4} ${peigneBottom} L ${xMid - 4} ${goulotteTop + 2}`}
                      stroke={WIRE.neutral} strokeWidth={2.2} lineCap="round"
                    />
                    {/* Earth: peigne -> bend -> enter vertical PE gutter -> bar */}
                    <Path
                      data={`M ${xMid + 4} ${peigneBottom}
                               L ${xMid + 4} ${goulotteTop + 2}
                               L ${peGutterX} ${goulotteTop + 2}
                               L ${peGutterX} ${peGutterBottomY}`}
                      stroke={WIRE.peYellow} strokeWidth={2} lineCap="round"
                    />
                    <Path
                      data={`M ${xMid + 4} ${peigneBottom}
                               L ${xMid + 4} ${goulotteTop + 2}
                               L ${peGutterX} ${goulotteTop + 2}
                               L ${peGutterX} ${peGutterBottomY}`}
                      stroke={WIRE.peGreen} strokeWidth={1.4} lineCap="round" dash={[5, 3]}
                    />

                    {/* Cable section label (printed sticker) above goulotte */}
                    <CableLabel
                      x={xMid} y={goulotteTop - 14}
                      main={getCableMain(props)}
                      sub={getCableSub(props)}
                    />

                    {/* Circuit-name sticker below the goulotte — auto-shrinks font
                        and allows overflow so 1-module breakers still show their name */}
                    <Group>
                      <Rect
                        x={colX} y={goulotteTop + goulotteHeight + 4}
                        width={w} height={16}
                        fill="#FFFFFF" stroke="#94A3B8" strokeWidth={0.5}
                        cornerRadius={1}
                      />
                      <Text
                        x={colX + 1} y={goulotteTop + goulotteHeight + 9}
                        width={w - 2}
                        text={props.name || 'Circuit'}
                        fontSize={labelFontSize}
                        fontStyle="bold" fill="#0F172A"
                        align="center"
                        fontFamily="Inter, sans-serif"
                        ellipsis wrap="none"
                      />
                    </Group>
                  </Group>
                );
              })}
            </Group>
          );
        });
      })()}

      {/* ════════════════════════════════════════════════════════════════
          4. EARTH BAR — Brass terminal bar at the bottom (laiton)
          ════════════════════════════════════════════════════════════════ */}
      <Group listening={false}>
        {/* Mounting brackets */}
        <Rect x={railX + 10} y={earthBarY - 4} width={6} height={14} fill="#52525B" cornerRadius={0.6} />
        <Rect x={railX + railWidth - 16} y={earthBarY - 4} width={6} height={14} fill="#52525B" cornerRadius={0.6} />
        {/* Brass bar body */}
        <Rect
          x={railX + 18} y={earthBarY}
          width={railWidth - 36} height={10}
          fillLinearGradientStartPoint={{ x: 0, y: earthBarY }}
          fillLinearGradientEndPoint={{ x: 0, y: earthBarY + 10 }}
          fillLinearGradientColorStops={[0, '#FDE047', 0.5, '#EAB308', 1, '#A16207']}
          stroke="#854D0E" strokeWidth={0.8}
          cornerRadius={1.2}
          shadowColor="black" shadowBlur={2} shadowOffset={{ x: 0, y: 1 }} shadowOpacity={0.3}
        />
        {/* Yellow/green striped overlay */}
        <Rect
          x={railX + 18} y={earthBarY}
          width={railWidth - 36} height={10}
          fill="#22C55E" opacity={0.35} dash={[4, 3]}
        />
        {/* Terminal blocks */}
        {Array.from({ length: Math.max(4, Math.floor((railWidth - 36) / 18)) }).map((_, i) => {
          const cx = railX + 24 + i * 18;
          return (
            <Group key={`earth-tb-${i}`}>
              <Rect x={cx - 3} y={earthBarY + 1} width={6} height={8}
                fill="#0F172A" stroke="#000" strokeWidth={0.3} cornerRadius={0.6}
              />
              <Circle x={cx} y={earthBarY + 5} radius={1.6}
                fillLinearGradientStartPoint={{ x: -1, y: -1 }}
                fillLinearGradientEndPoint={{ x: 1, y: 1 }}
                fillLinearGradientColorStops={[0, '#52525B', 1, '#0F172A']}
                stroke="#000" strokeWidth={0.2}
              />
              <Line points={[cx - 1.2, earthBarY + 5, cx + 1.2, earthBarY + 5]} stroke="#FBBF24" strokeWidth={0.4} />
              <Line points={[cx, earthBarY + 3.8, cx, earthBarY + 6.2]} stroke="#FBBF24" strokeWidth={0.4} />
            </Group>
          );
        })}
        {/* Label */}
        <Text
          x={railX + 22} y={earthBarY - 11}
          text="BARRE DE TERRE (PE)"
          fontSize={7} fontStyle="bold" fill="#166534"
          fontFamily="monospace"
        />
      </Group>
    </Group>
  );
};