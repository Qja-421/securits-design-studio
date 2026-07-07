import React from 'react';
import { Group, Line, Rect, Circle, Path, Text } from 'react-konva';
import { ElectricalComponent, Cabinet } from '../../types/electrical';
import { resolveBrand } from '../../types/brand';

// =========================================================================
// Cable bundle label (e.g. "3G2.5mm²") — appears along each load wire
// =========================================================================
const CableLabel: React.FC<{
  x: number;
  y: number;
  main: string;
  sub: string;
  paperBg?: string;
  textColor?: string;
}> = ({ x, y, main, sub, paperBg = '#FFFFFF', textColor = '#1F2937' }) => (
  <Group x={x} y={y} listening={false}>
    <Rect
      x={-34}
      y={-13}
      width={68}
      height={26}
      fill={paperBg}
      stroke="#475569"
      strokeWidth={0.6}
      cornerRadius={2}
      shadowColor="black"
      shadowBlur={1.5}
      shadowOpacity={0.15}
      shadowOffset={{ x: 0, y: 0.5 }}
    />
    <Text
      x={-34}
      y={-10.5}
      width={68}
      text={main}
      fontSize={9}
      fontStyle="bold"
      fill={textColor}
      align="center"
      fontFamily="monospace"
    />
    <Text
      x={-34}
      y={2}
      width={68}
      text={sub}
      fontSize={6.8}
      fill="#64748B"
      align="center"
      fontFamily="monospace"
    />
  </Group>
);

// =========================================================================
// Terminal designation tag (L1, N, PE, L1/L2/L3…) — conforms to single-
// line schematic conventions used on Legrand/Hager terminal blocks.
// =========================================================================
const TerminalTag: React.FC<{ x: number; y: number; text: string; tone?: 'phase' | 'neutral' | 'earth' }> = ({
  x,
  y,
  text,
  tone = 'phase'
}) => {
  const palette = {
    phase: { fill: '#FFFFFF', stroke: '#1F2937', text: '#1F2937' },
    neutral: { fill: '#FFFFFF', stroke: '#1E3A8A', text: '#1E3A8A' },
    earth: { fill: '#FFFFFF', stroke: '#15803D', text: '#15803D' }
  } as const;
  const p = palette[tone];
  return (
    <Group x={x} y={y} listening={false}>
      <Rect
        x={-10}
        y={-3.6}
        width={20}
        height={7.2}
        fill={p.fill}
        stroke={p.stroke}
        strokeWidth={0.5}
        cornerRadius={1.5}
      />
      <Text
        x={-10}
        y={-2.8}
        width={20}
        text={text}
        fontSize={5}
        fontStyle="bold"
        fill={p.text}
        align="center"
        fontFamily="monospace"
      />
    </Group>
  );
};

// Helper: build the cable section label like "3G2.5mm²" or "5G6mm²"
const getCableMain = (props: ElectricalComponent['properties']): string => {
  const isTri = props.voltageV === 400;
  const conductors = isTri ? (props.poles === '4P' ? 5 : 4) : 3;
  return `${conductors}G${props.cableSectionMm2}mm²`;
};

// Helper: secondary line on cable label (calibre + longueur)
const getCableSub = (props: ElectricalComponent['properties']): string =>
  `${props.ratingA}A · ${props.cableLengthM}m`;

// Helper: phase terminal designation (single phase → "L1", tri → "L1/L2/L3")
const getPhaseTag = (props: ElectricalComponent['properties']): string => {
  if (props.voltageV === 400) {
    return props.poles === '4P' ? 'L1/L2/L3/N' : 'L1/L2/L3';
  }
  return 'L1';
};

interface CablingRendererProps {
  cabinet: Cabinet;
  railYPositions: number[];
  railWidth: number;
  railX: number;
  moduleWidthPx: number;
  componentHeight: number;
  presentationMode: boolean;
}

// Schematic wire colors — vibrant, high contrast, like a hand-drawn single-line diagram
const SCHEMATIC_WIRE_COLORS = {
  phase: '#E11D48',      // Crimson red (instead of the previous muddy brown)
  phaseTri: '#1F2937',   // Near-black for tri-phase
  neutral: '#2563EB',    // Vivid blue
  earthYellow: '#FACC15',
  earthGreen: '#22C55E',
  sheath: '#1F2937'
};

export const CablingRenderer: React.FC<CablingRendererProps> = ({
  cabinet,
  railYPositions,
  railWidth,
  railX,
  moduleWidthPx,
  componentHeight,
  presentationMode
}) => {
  if (presentationMode) return null; // Hide wiring in closed-door presentation mode

  const components = cabinet.components;

  // Schematic layout offsets
  const componentBottomY = (rY: number) => rY + componentHeight - 15;
  const componentTopY = (rY: number) => rY + 15;

  // Bus bars (peignes horizontaux) sit 6px above each component row
  const busOffsetY = 6;
  const busBarHeight = 5;

  // Cable tray (goulotte) sits below the bus bar to collect drops
  const cableTrayY = busOffsetY + busBarHeight + 4;
  const cableTrayHeight = 18;

  // Bottom of the entire wiring area (for vertical drops from the last row)
  const earthBarY = railYPositions[railYPositions.length - 1] + componentHeight + 75;

  return (
    <Group>
      {/* ============================================================
          0. SCHEMATIC BACKGROUND (only behind the wiring area)
          ============================================================ */}
      {railYPositions.map((rY, rowIndex) => (
        <Rect
          key={`schematic-bg-${rowIndex}`}
          x={railX - 30}
          y={rY - 8}
          width={railWidth + 60}
          height={componentHeight + 90}
          fill="#FAFAF7"
          stroke="#CBD5E1"
          strokeWidth={0.5}
          cornerRadius={2}
          listening={false}
        />
      ))}

      {/* ============================================================
          1. HORIZONTAL BUS BARS (Peignes Phase + Neutre par rangée)
          ============================================================ */}
      {railYPositions.map((rY, rowIndex) => {
        const rowComponents = components.filter((c) => c.rowIndex === rowIndex);
        if (rowComponents.length === 0) return null;
        const minX = railX + 4;
        const maxX = railX + railWidth - 4;

        return (
          <Group key={`bus-bars-${rowIndex}`} listening={false}>
            {/* Phase bus (red) */}
            <Rect
              x={minX}
              y={rY - busOffsetY - busBarHeight}
              width={maxX - minX}
              height={busBarHeight}
              fill={SCHEMATIC_WIRE_COLORS.phase}
              stroke="#1F2937"
              strokeWidth={0.4}
              cornerRadius={1}
            />
            {/* Neutral bus (blue) — just under the phase bus */}
            <Rect
              x={minX}
              y={rY - busOffsetY + 1}
              width={maxX - minX}
              height={busBarHeight}
              fill={SCHEMATIC_WIRE_COLORS.neutral}
              stroke="#1E3A8A"
              strokeWidth={0.4}
              cornerRadius={1}
            />
            {/* Bus identification label (top-left of the row) */}
            <Text
              x={railX - 28}
              y={rY - busOffsetY - busBarHeight - 2}
              text={`R${rowIndex + 1}`}
              fontSize={6.5}
              fontStyle="bold"
              fill="#475569"
              fontFamily="monospace"
            />
          </Group>
        );
      })}

      {/* ============================================================
          2. PER-COMPONENT SHORT DROPS (Phase + Neutre vers chaque module)
          ============================================================ */}
      {components.map((c) => {
        if (c.type === 'load') return null; // Loads handled separately
        const rY = railYPositions[c.rowIndex];
        const topX = railX + (c.moduleIndex + c.widthModules / 2) * moduleWidthPx;
        const isTri = c.properties.voltageV === 400;
        const phaseColor = isTri ? SCHEMATIC_WIRE_COLORS.phaseTri : SCHEMATIC_WIRE_COLORS.phase;
        const phaseTag = getPhaseTag(c.properties);
        return (
          <Group key={`drop-${c.id}`} listening={false}>
            <Line
              points={[topX, rY - busOffsetY - 1, topX, rY + 15]}
              stroke={phaseColor}
              strokeWidth={2.4}
              lineCap="round"
            />
            <Line
              points={[topX - 3, rY - busOffsetY + 3, topX - 3, rY + 15]}
              stroke={SCHEMATIC_WIRE_COLORS.neutral}
              strokeWidth={2.4}
              lineCap="round"
            />
            <TerminalTag x={topX + 7} y={rY - 2} text={phaseTag} tone="phase" />
            <TerminalTag x={topX - 7} y={rY - 2} text="N" tone="neutral" />
          </Group>
        );
      })}

      {/* ============================================================
          3. LOAD CIRCUITS (Phase + Neutre + Terre vers chaque récepteur)
          Each load shows: terminal number (1..6), cable section label,
          circuit name (under the breaker), and the route to the earth bar.
          ============================================================ */}
      {components.map((c, idx) => {
        if (c.type !== 'load') return null;

        const rY = railYPositions[c.rowIndex];
        const colX = railX + c.moduleIndex * moduleWidthPx;
        const width = c.widthModules * moduleWidthPx;
        const topX = colX + width / 2;
        const topY = componentTopY(rY);
        const bottomY = componentBottomY(rY);
        const props = c.properties;
        const isTri = props.voltageV === 400;
        const phaseColor = isTri ? SCHEMATIC_WIRE_COLORS.phaseTri : SCHEMATIC_WIRE_COLORS.phase;

        // Terminal numbers (1, 2, 3, 4, 5, 6) above the breaker
        const terminalNumbers = isTri
          ? (props.poles === '4P' ? ['1', '2', '3', 'N'] : ['1', '2', '3'])
          : ['1', '2', '3'];

        // Compute position for the cable label and circuit name
        const labelX = colX + width / 2;
        const labelY = bottomY + 24;
        const circuitNameY = bottomY + 56;

        return (
          <Group key={`load-${c.id}`} listening={false}>
            {/* 3A. Drop from bus bars to breaker top */}
            <Line
              points={[topX, rY - busOffsetY - 1, topX, topY]}
              stroke={phaseColor}
              strokeWidth={2.4}
              lineCap="round"
            />
            <Line
              points={[topX - 4, rY - busOffsetY + 3, topX - 4, topY]}
              stroke={SCHEMATIC_WIRE_COLORS.neutral}
              strokeWidth={2.4}
              lineCap="round"
            />

            {/* 3B. Phase + neutral exiting the breaker bottom */}
            <Line
              points={[topX, bottomY, topX, bottomY + 14]}
              stroke={phaseColor}
              strokeWidth={2.4}
              lineCap="round"
            />
            <Line
              points={[topX - 4, bottomY, topX - 4, bottomY + 14]}
              stroke={SCHEMATIC_WIRE_COLORS.neutral}
              strokeWidth={2.4}
              lineCap="round"
            />

            {/* 3C. Earth wire to the earth bar */}
            <Path
              data={`M ${topX + 4} ${bottomY} L ${topX + 4} ${bottomY + 14} C ${topX + 4} ${bottomY + 30}, ${railX - 8} ${bottomY + 40}, ${railX - 8} ${earthBarY - 5}`}
              stroke={SCHEMATIC_WIRE_COLORS.earthYellow}
              strokeWidth={2.2}
              lineCap="round"
              dash={[5, 3]}
            />
            <Path
              data={`M ${topX + 4} ${bottomY} L ${topX + 4} ${bottomY + 14} C ${topX + 4} ${bottomY + 30}, ${railX - 8} ${bottomY + 40}, ${railX - 8} ${earthBarY - 5}`}
              stroke={SCHEMATIC_WIRE_COLORS.earthGreen}
              strokeWidth={1.4}
              lineCap="round"
              dash={[5, 3]}
              opacity={0.9}
            />

            {/* 3D. Terminal numbers (1..6) above the breaker */}
            {terminalNumbers.map((tn, tIdx) => {
              const spacing = Math.min(6, width / (terminalNumbers.length + 1));
              const tx = colX + spacing * (tIdx + 1);
              return (
                <Group key={`tn-${c.id}-${tIdx}`}>
                  <Text
                    x={tx - 4}
                    y={rY - busOffsetY - 14}
                    width={8}
                    text={tn}
                    fontSize={6}
                    fontStyle="bold"
                    fill="#1F2937"
                    align="center"
                    fontFamily="monospace"
                  />
                </Group>
              );
            })}

            {/* 3E. Terminal designation tags on the breaker bottom */}
            <TerminalTag x={topX + 7} y={bottomY + 2} text={getPhaseTag(props)} tone="phase" />
            <TerminalTag x={topX - 7} y={bottomY + 2} text="N" tone="neutral" />
            <TerminalTag x={topX + 4} y={bottomY + 2} text="PE" tone="earth" />

            {/* 3F. Cable section label (e.g. "3G2.5mm² / 16A · 20m") */}
            <CableLabel
              x={labelX}
              y={labelY}
              main={getCableMain(props)}
              sub={getCableSub(props)}
            />

            {/* 3G. Circuit name below the breaker — readable single-line label */}
            <Group>
              <Rect
                x={colX}
                y={circuitNameY - 4}
                width={width}
                height={20}
                fill="#FFFFFF"
                stroke="#94A3B8"
                strokeWidth={0.5}
                cornerRadius={1.5}
              />
              <Text
                x={colX + 2}
                y={circuitNameY + 2}
                width={width - 4}
                text={props.name || 'Circuit'}
                fontSize={7.5}
                fontStyle="bold"
                fill="#0F172A"
                align="center"
                fontFamily="Inter, sans-serif"
                ellipsis
                wrap="none"
              />
            </Group>
          </Group>
        );
      })}

      {/* ============================================================
          4. EARTH BAR (Barre de terre) at the bottom of the cabinet
          ============================================================ */}
      <Group x={railX - 8} y={earthBarY} listening={false}>
        <Rect
          x={0}
          y={0}
          width={railWidth + 16}
          height={10}
          fill="#FACC15"
          stroke="#854D0E"
          strokeWidth={0.8}
          cornerRadius={1}
          shadowColor="black"
          shadowBlur={2}
          shadowOpacity={0.18}
          shadowOffset={{ x: 0, y: 1 }}
        />
        <Rect
          x={0}
          y={0}
          width={railWidth + 16}
          height={10}
          fill="#22C55E"
          opacity={0.4}
          dash={[4, 3]}
        />
        {/* Terminal blocks (small dots) */}
        {Array.from({ length: Math.floor((railWidth + 16) / 14) }).map((_, i) => {
          const cx = 7 + i * 14;
          return (
            <Group key={`es-${i}`}>
              <Rect x={cx - 3} y={2} width={6} height={6} fill="#0F172A" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
              <Circle x={cx} y={5} radius={1.2} fill="#1F2937" />
            </Group>
          );
        })}
        <Text
          x={0}
          y={-9}
          text="BARRE DE TERRE (PE)"
          fontSize={6.5}
          fontStyle="bold"
          fill="#15803D"
          fontFamily="monospace"
        />
      </Group>

      {/* ============================================================
          5. INTER-ROW CONNECTIONS (Gaines inter-rangées)
          ============================================================ */}
      {(() => {
        if (railYPositions.length <= 1) return null;
        return railYPositions
          .map((_, rowIndex) => ({ rowIndex }))
          .filter(({ rowIndex }) => rowIndex > 0)
          .map(({ rowIndex }) => {
            const previousY = railYPositions[rowIndex - 1] + componentHeight + 20;
            const currentY = railYPositions[rowIndex] - busOffsetY;
            const sheathX = railX - 22;
            const path = `M ${sheathX} ${previousY} L ${sheathX} ${currentY}`;
            return (
              <Group key={`inter-row-${rowIndex}`} listening={false}>
                <Path
                  data={path}
                  stroke={SCHEMATIC_WIRE_COLORS.sheath}
                  strokeWidth={6}
                  lineCap="round"
                  opacity={0.85}
                />
                <Path
                  data={path}
                  stroke="#94A3B8"
                  strokeWidth={3.5}
                  lineCap="round"
                />
                {/* Phase + neutral wires inside the sheath */}
                <Line
                  points={[sheathX, previousY, sheathX, currentY]}
                  stroke={SCHEMATIC_WIRE_COLORS.phase}
                  strokeWidth={1.6}
                  lineCap="round"
                />
                <Line
                  points={[sheathX - 1.5, previousY, sheathX - 1.5, currentY]}
                  stroke={SCHEMATIC_WIRE_COLORS.neutral}
                  strokeWidth={1.6}
                  lineCap="round"
                />
                <Text
                  x={sheathX - 5}
                  y={(previousY + currentY) / 2 - 3}
                  text={`R${rowIndex}`}
                  fontSize={6}
                  fontStyle="bold"
                  fill="#475569"
                  fontFamily="monospace"
                />
              </Group>
            );
          });
      })()}

      {/* ============================================================
          6. PER-COMPONENT TERMINAL NUMBERS (1-6 strip above each row)
          Mimics the schematic reference number strip from image 1.
          ============================================================ */}
      {railYPositions.map((rY, rowIndex) => {
        const rowComponents = components.filter((c) => c.rowIndex === rowIndex);
        if (rowComponents.length === 0) return null;
        const numSlots = cabinet.modulesPerRow;
        const ticks = Array.from({ length: numSlots + 1 });
        return (
          <Group key={`term-strip-${rowIndex}`} listening={false}>
            {ticks.map((_, tickIdx) => {
              const x = railX + tickIdx * moduleWidthPx;
              return (
                <React.Fragment key={`t-${tickIdx}`}>
                  <Line
                    points={[x, rY - busOffsetY - 8, x, rY - busOffsetY - 4]}
                    stroke="#94A3B8"
                    strokeWidth={0.4}
                  />
                </React.Fragment>
              );
            })}
          </Group>
        );
      })}
    </Group>
  );
};
