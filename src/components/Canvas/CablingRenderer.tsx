import React from 'react';
import { Group, Line, Rect, Circle, Path } from 'react-konva';
import { ElectricalComponent, Cabinet } from '../../types/electrical';

interface CablingRendererProps {
  cabinet: Cabinet;
  railYPositions: number[];
  railWidth: number;
  railX: number;
  moduleWidthPx: number;
  componentHeight: number;
  presentationMode: boolean;
}

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
  const WIRE_COLORS = {
    phase: '#5B2A0A',
    phaseTri: '#050505',
    neutral: '#00AEEF',
    earthYellow: '#FFD400',
    earthGreen: '#16A34A',
    ferrule: '#2C2C2A'
  };

  // Helper to calculate the coordinates of top and bottom terminal connection points for a component
  const getComponentTerminals = (c: ElectricalComponent) => {
    const rY = railYPositions[c.rowIndex];
    const xMid = railX + (c.moduleIndex + c.widthModules / 2) * moduleWidthPx;
    return {
      topX: xMid,
      topY: rY + 15,
      bottomX: xMid,
      bottomY: rY + componentHeight - 15
    };
  };

  const getRowCombBounds = (rowComponents: ElectricalComponent[]) => {
    const xs = rowComponents.map((c) => railX + c.moduleIndex * moduleWidthPx);
    const widths = rowComponents.map((c) => c.widthModules * moduleWidthPx);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs.map((x, idx) => x + widths[idx]));

    return {
      minX: Math.max(railX, minX),
      maxX: Math.min(railX + railWidth, maxX)
    };
  };

  // Helper to generate Bezier Curve points between two nodes with natural sag
  // Returns SVG-like path string for cubic Bezier
  const drawBezierPath = (x1: number, y1: number, x2: number, y2: number, sagY = 50, randomOffset = 0) => {
    const cp1x = x1 + randomOffset;
    const cp1y = y1 + sagY;
    const cp2x = x2 - randomOffset;
    const cp2y = y2 - sagY;
    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  };

  // 1. Earth Terminal Bar (Barre de terre) position
  // Located at the very bottom of the cabinet enclosure
  const earthBarX = railX + 50;
  const earthBarY = railYPositions[railYPositions.length - 1] + componentHeight + 50;

  // Cable tray (goulotte horizontale) sits just under each row of components,
  // in the cabling channel between this rail and the next. It collects all
  // vertical wire drops and gives the cabinet a realistic look.
  const cableTrayHeight = 22;
  const cableTrayYOffset = componentHeight + 6;

  return (
    <Group>
      {/* ----------------------------------------------------
          0. CABLE TRAYS (Goulottes horizontales par rangée)
          ----------------------------------------------------
          Drawn BEFORE the wires so cables visually sit inside the tray. */}
      {railYPositions.map((rY, rowIndex) => {
        const trayY = rY + cableTrayYOffset;
        const hasNextRow = rowIndex < railYPositions.length - 1;
        const rowComponents = components.filter((c) => c.rowIndex === rowIndex);
        const hasLoads = rowComponents.some((c) => c.type === 'load');
        return (
          <Group key={`tray-${rowIndex}`} listening={false}>
            {/* Tray outer shell (PVC light gray, stronger 3D contrast) */}
            <Rect
              x={railX - 8}
              y={trayY}
              width={railWidth + 16}
              height={cableTrayHeight}
              fillLinearGradientStartPoint={{ x: 0, y: trayY }}
              fillLinearGradientEndPoint={{ x: 0, y: trayY + cableTrayHeight }}
              fillLinearGradientColorStops={[0, '#d1d5db', 0.45, '#f3f4f6', 0.55, '#f9fafb', 1, '#4b5563']}
              stroke="#1f2937"
              strokeWidth={1.2}
              cornerRadius={2}
              shadowColor="black"
              shadowBlur={6}
              shadowOffset={{ x: 0, y: 3 }}
              shadowOpacity={0.45}
            />
            {/* Tray opening slot (darker slit where wires enter) */}
            <Rect
              x={railX - 4}
              y={trayY + cableTrayHeight / 2 - 2}
              width={railWidth + 8}
              height={4}
              fill="#0f172a"
              cornerRadius={1}
            />
            {/* Tray mounting brackets on each side */}
            <Rect x={railX - 13} y={trayY + 3} width={5} height={cableTrayHeight - 6} fill="#1f2937" cornerRadius={0.5} />
            <Rect x={railX + railWidth + 8} y={trayY + 3} width={5} height={cableTrayHeight - 6} fill="#1f2937" cornerRadius={0.5} />
            {/* Subtle highlight along the top edge */}
            <Line points={[railX - 6, trayY + 1.5, railX + railWidth + 6, trayY + 1.5]} stroke="#ffffff" strokeWidth={0.8} opacity={0.5} />
            {/* D. Cable bundles inside the tray (3 small dark circles, aligned) */}
            {hasLoads && Array.from({ length: 3 }).map((_, k) => {
              const cx = railX + railWidth * (0.25 + 0.25 * k);
              const cy = trayY + cableTrayHeight - 4;
              return (
                <Circle key={`bundle-${k}`} x={cx} y={cy} radius={2.2} fill="#0f172a" opacity={0.65} />
              );
            })}
            {/* Vertical drop conduit from last row's tray down to the earth bar */}
            {!hasNextRow && (
              <Rect
                x={railX - 8}
                y={trayY + cableTrayHeight}
                width={railWidth + 16}
                height={Math.max(20, earthBarY - (trayY + cableTrayHeight) - 12)}
                fill="#0f172a"
                cornerRadius={2}
                opacity={0.92}
                shadowColor="black"
                shadowBlur={4}
                shadowOffset={{ x: 0, y: 2 }}
                shadowOpacity={0.3}
              />
            )}
          </Group>
        );
      })}

      {/* ----------------------------------------------------
          1. HORIZONTAL DISTRIBUTION COMBS (Peignes de pontage)
          ---------------------------------------------------- */}
      {railYPositions.map((rY, rowIndex) => {
        const rowComponents = components.filter((c) => c.rowIndex === rowIndex);
        if (rowComponents.length === 0) return null;

        const { minX, maxX } = getRowCombBounds(rowComponents);
        const combWidth = Math.max(moduleWidthPx, maxX - minX);

        return (
          <Group key={`comb-${rowIndex}`}>
            {/* Horizontal comb bars: phase and neutral are kept visibly distinct. */}
            <Rect
              x={minX + 2}
              y={rY + 5}
              width={combWidth - 4}
              height={5}
              fill={WIRE_COLORS.phase}
              stroke="#2C2C2A"
              strokeWidth={0.5}
              cornerRadius={1}
              shadowColor="black"
              shadowBlur={1}
              shadowOffset={{ x: 0, y: 1 }}
              shadowOpacity={0.2}
            />
            <Rect
              x={minX + 2}
              y={rY + 12}
              width={combWidth - 4}
              height={5}
              fill={WIRE_COLORS.neutral}
              stroke="#075985"
              strokeWidth={0.5}
              cornerRadius={1}
              shadowColor="black"
              shadowBlur={1}
              shadowOffset={{ x: 0, y: 1 }}
              shadowOpacity={0.2}
            />
            {/* Every rail-mounted component gets visible short links to the comb above it. */}
            {rowComponents.map((c) => {
              const { topX } = getComponentTerminals(c);
              const phaseColor = c.properties.voltageV === 400 ? WIRE_COLORS.phaseTri : WIRE_COLORS.phase;
              return (
                <Group key={`comb-link-${c.id}`}>
                  <Line
                    points={[topX + 3, rY + 8, topX + 3, rY + 15]}
                    stroke={phaseColor}
                    strokeWidth={4.5}
                    lineCap="round"
                  />
                  <Line
                    points={[topX - 3, rY + 15, topX - 3, rY + 20]}
                    stroke={WIRE_COLORS.neutral}
                    strokeWidth={4.5}
                    lineCap="round"
                  />
                  {/* Phase terminal block (bornier à vis) above the component — size ×1.7 */}
                  <Group x={topX + 3} y={rY + 15}>
                    <Rect x={-5.4} y={-3.7} width={10.8} height={7.4} fill="#1f2937" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
                    <Line points={[-2.7, 0, 2.7, 0]} stroke="#fbbf24" strokeWidth={0.9} />
                    <Line points={[0, -2.3, 0, 2.3]} stroke="#fbbf24" strokeWidth={0.9} />
                  </Group>
                  {/* Neutral terminal block above the component — size ×1.7 */}
                  <Group x={topX - 3} y={rY + 20}>
                    <Rect x={-5.4} y={-3.7} width={10.8} height={7.4} fill="#0c4a6e" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
                    <Line points={[-2.7, 0, 2.7, 0]} stroke="#7dd3fc" strokeWidth={0.9} />
                    <Line points={[0, -2.3, 0, 2.3]} stroke="#7dd3fc" strokeWidth={0.9} />
                  </Group>
                </Group>
              );
            })}
          </Group>
        );
      })}

      {/* ----------------------------------------------------
          2. GENERAL DISTRIBUTION WIRES & EARTH LEADS
          ---------------------------------------------------- */}
      {components.map((c, idx) => {
        if (c.type !== 'load') return null;

        const { bottomX, bottomY } = getComponentTerminals(c);
        const props = c.properties;

        // Wire width proportional to section (boosted ~50% for visibility)
        const wireWidth = Math.max(3.8, Math.min(8.5, props.cableSectionMm2 * 0.85));
        // Outer black sheath width (gives the "câble sous gaine" look)
        const sheathWidth = wireWidth + 3.5;

        // Destination for load wires: loop out of breaker and go down to the base
        const destY = bottomY + 60;
        const destX = bottomX + (idx % 2 === 0 ? 12 : -12); // Spread destinations

        // Add a slight random offset to points of control for a hand-cabled feel
        const randOffset = (idx % 3 - 1) * 6;

        return (
          <Group key={`wires-load-${c.id}`}>
            {/* A. Black outer sheath behind the 3 wires (faisceau sous gaine) */}
            <Path
              data={drawBezierPath(bottomX - 3, bottomY + 1, destX - 2, destY, 32, randOffset)}
              stroke="#0f172a"
              strokeWidth={sheathWidth}
              lineCap="round"
              opacity={0.92}
            />

            {/* Neutral Wire (Light Blue) */}
            <Path
              data={drawBezierPath(bottomX - 2.5, bottomY, destX - 1.5, destY, 30, randOffset)}
              stroke={WIRE_COLORS.neutral}
              strokeWidth={wireWidth}
              lineCap="round"
            />
            {/* Neutral Terminal blocks (bornes à vis) at both ends — size ×1.7 */}
            <Group x={bottomX - 2.5} y={bottomY + 1}>
              <Rect x={-5.4} y={-3.7} width={10.8} height={7.4} fill="#0c4a6e" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
              <Line points={[-2.7, 0, 2.7, 0]} stroke="#7dd3fc" strokeWidth={0.9} />
              <Line points={[0, -2.3, 0, 2.3]} stroke="#7dd3fc" strokeWidth={0.9} />
            </Group>
            <Group x={destX - 1.5} y={destY}>
              <Rect x={-5.4} y={-3.7} width={10.8} height={7.4} fill="#0c4a6e" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
              <Line points={[-2.7, 0, 2.7, 0]} stroke="#7dd3fc" strokeWidth={0.9} />
              <Line points={[0, -2.3, 0, 2.3]} stroke="#7dd3fc" strokeWidth={0.9} />
            </Group>

            {/* Phase Wire (Brown or Black) */}
            <Path
              data={drawBezierPath(bottomX + 2.5, bottomY, destX + 1.5, destY, 35, randOffset + 4)}
              stroke={props.voltageV === 400 ? WIRE_COLORS.phaseTri : WIRE_COLORS.phase}
              strokeWidth={wireWidth}
              lineCap="round"
            />
            {/* Phase Terminal blocks at both ends — size ×1.7 */}
            <Group x={bottomX + 2.5} y={bottomY + 1}>
              <Rect x={-5.4} y={-3.7} width={10.8} height={7.4} fill="#1f2937" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
              <Line points={[-2.7, 0, 2.7, 0]} stroke="#fbbf24" strokeWidth={0.9} />
              <Line points={[0, -2.3, 0, 2.3]} stroke="#fbbf24" strokeWidth={0.9} />
            </Group>
            <Group x={destX + 1.5} y={destY}>
              <Rect x={-5.4} y={-3.7} width={10.8} height={7.4} fill="#1f2937" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
              <Line points={[-2.7, 0, 2.7, 0]} stroke="#fbbf24" strokeWidth={0.9} />
              <Line points={[0, -2.3, 0, 2.3]} stroke="#fbbf24" strokeWidth={0.9} />
            </Group>

            {/* Earth Wire (Yellow/Green alternating striped representation) */}
            {/* Black sheath behind the earth wire too */}
            <Path
              data={drawBezierPath(bottomX, bottomY + 4, earthBarX + (idx * 5) % 150, earthBarY - 5, 80, randOffset - 6)}
              stroke="#0f172a"
              strokeWidth={wireWidth + 1.5}
              lineCap="round"
              opacity={0.7}
            />
            <Path
              data={drawBezierPath(bottomX, bottomY + 4, earthBarX + (idx * 5) % 150, earthBarY - 5, 80, randOffset - 6)}
              stroke={WIRE_COLORS.earthYellow}
              strokeWidth={wireWidth}
              lineCap="round"
            />
            <Path
              data={drawBezierPath(bottomX, bottomY + 4, earthBarX + (idx * 5) % 150, earthBarY - 5, 80, randOffset - 6)}
              stroke={WIRE_COLORS.earthGreen}
              strokeWidth={wireWidth}
              dash={[7, 6]}
              lineCap="round"
            />
            {/* Earth terminal block at the component end — size ×1.7 */}
            <Group x={bottomX} y={bottomY + 4}>
              <Rect x={-5.4} y={-3.7} width={10.8} height={7.4} fill="#15803d" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
              <Line points={[-2.7, 0, 2.7, 0]} stroke="#fde047" strokeWidth={0.9} />
              <Line points={[0, -2.3, 0, 2.3]} stroke="#fde047" strokeWidth={0.9} />
            </Group>

            {/* General cable exit conduit representation */}
            <Rect
              x={destX - 8}
              y={destY}
              width={16}
              height={14}
              fill="#1f2937" // Dark sheath exit
              cornerRadius={2}
            />
          </Group>
        );
      })}

      {/* Earth bar drawing at the base */}
      <Group x={earthBarX} y={earthBarY}>
        {/* Mounting brackets (DIN rail clips) on each side */}
        <Rect x={-4} y={-10} width={4} height={12} fill="#4b5563" cornerRadius={0.5} />
        <Rect x={180} y={-10} width={4} height={12} fill="#4b5563" cornerRadius={0.5} />
        {/* Brass ground terminal bar with metallic gradient */}
        <Rect
          x={0}
          y={-8}
          width={180}
          height={8}
          fillLinearGradientStartPoint={{ x: 0, y: -8 }}
          fillLinearGradientEndPoint={{ x: 0, y: 0 }}
          fillLinearGradientColorStops={[0, '#fde047', 0.5, '#eab308', 1, '#a16207']}
          stroke="#854d0e"
          strokeWidth={1}
          cornerRadius={1}
          shadowColor="black"
          shadowBlur={2}
          shadowOffset={{ x: 0, y: 1 }}
          shadowOpacity={0.25}
        />
        {/* Terminal blocks + cross-head screws for each connection */}
        {Array.from({ length: 12 }).map((_, i) => {
          const cx = 12 + i * 14;
          return (
            <Group key={`es-${i}`}>
              {/* Block base */}
              <Rect x={cx - 3} y={-7} width={6} height={6} fill="#0c4a6e" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
              {/* Screw body */}
              <Circle x={cx} y={-4} radius={1.8} fill="#78350f" stroke="#111" strokeWidth={0.5} />
              {/* Cross-head (+) */}
              <Line points={[cx - 1.2, -4, cx + 1.2, -4]} stroke="#fbbf24" strokeWidth={0.5} />
              <Line points={[cx, -5.2, cx, -2.8]} stroke="#fbbf24" strokeWidth={0.5} />
            </Group>
          );
        })}
      </Group>

      {/* ----------------------------------------------------
          3. INTER-ROW CONNECTION (Liaison Inter-Rangées)
          ---------------------------------------------------- */}
      {(() => {
        const rows = railYPositions
          .map((_, rowIndex) => ({
            rowIndex,
            rowComponents: components.filter((c) => c.rowIndex === rowIndex)
          }));

        if (rows.length <= 1) return null;

        return (
          <Group>
            {rows
              .filter((row) => row.rowIndex > 0)
              .map(({ rowIndex, rowComponents }) => {
                const currentY = railYPositions[rowIndex];
                const previousY = railYPositions[rowIndex - 1];
                const target = rowComponents[0];
                const sheathX = railX - 18;
                const sheathStartY = previousY + componentHeight + 15;
                const sheathEndY = currentY + 14;
                const sheathCurve = `M ${sheathX} ${sheathStartY} C ${sheathX - 8} ${sheathStartY + 28}, ${sheathX + 8} ${sheathEndY - 28}, ${sheathX} ${sheathEndY}`;
                const targetTerminals = target ? getComponentTerminals(target) : null;

              return (
                <Group key={`row-feed-${rowIndex}`}>
                  {/* Inter-row sheath follows every visible rail; terminal wires are only drawn when a component exists. */}
                  <Path
                    data={sheathCurve}
                    stroke="#2C2C2A"
                    strokeWidth={10}
                    strokeScaleEnabled={false}
                    lineCap="round"
                    shadowColor="black"
                    shadowBlur={3}
                    shadowOpacity={0.25}
                  />
                  <Path
                    data={sheathCurve}
                    stroke="#9ca3af"
                    strokeWidth={8}
                    strokeScaleEnabled={false}
                    lineCap="round"
                  />
                  {targetTerminals && (
                    <>
                      <Path
                        data={`M ${sheathX} ${currentY + 10} Q ${targetTerminals.topX - 12} ${currentY + 2}, ${targetTerminals.topX - 3} ${targetTerminals.topY}`}
                        stroke={WIRE_COLORS.neutral}
                        strokeWidth={4.5}
                        lineCap="round"
                      />
                      <Path
                        data={`M ${sheathX} ${currentY + 16} Q ${targetTerminals.topX - 6} ${currentY + 6}, ${targetTerminals.topX + 3} ${targetTerminals.topY}`}
                        stroke={target.properties.voltageV === 400 ? WIRE_COLORS.phaseTri : WIRE_COLORS.phase}
                        strokeWidth={4.5}
                        lineCap="round"
                      />
                      {/* Inter-row neutral terminal block (bornier) — size ×1.7 */}
                      <Group x={targetTerminals.topX - 3} y={targetTerminals.topY}>
                        <Rect x={-5.7} y={-4} width={11.4} height={8} fill="#0c4a6e" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
                        <Line points={[-2.7, 0, 2.7, 0]} stroke="#7dd3fc" strokeWidth={0.9} />
                        <Line points={[0, -2.3, 0, 2.3]} stroke="#7dd3fc" strokeWidth={0.9} />
                      </Group>
                      {/* Inter-row phase terminal block (bornier) — size ×1.7 */}
                      <Group x={targetTerminals.topX + 3} y={targetTerminals.topY}>
                        <Rect x={-5.7} y={-4} width={11.4} height={8} fill="#1f2937" stroke="#000" strokeWidth={0.6} cornerRadius={1} />
                        <Line points={[-2.7, 0, 2.7, 0]} stroke="#fbbf24" strokeWidth={0.9} />
                        <Line points={[0, -2.3, 0, 2.3]} stroke="#fbbf24" strokeWidth={0.9} />
                      </Group>
                    </>
                  )}
                </Group>
              );
            })}
          </Group>
        );
      })()}
    </Group>
  );
};


