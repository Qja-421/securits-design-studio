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
  const cableTrayHeight = 18;
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
        return (
          <Group key={`tray-${rowIndex}`} listening={false}>
            {/* Tray outer shell (PVC gray, slight 3D feel via gradient) */}
            <Rect
              x={railX - 8}
              y={trayY}
              width={railWidth + 16}
              height={cableTrayHeight}
              fillLinearGradientStartPoint={{ x: 0, y: trayY }}
              fillLinearGradientEndPoint={{ x: 0, y: trayY + cableTrayHeight }}
              fillLinearGradientColorStops={[0, '#9ca3af', 0.4, '#d1d5db', 0.6, '#e5e7eb', 1, '#6b7280']}
              stroke="#374151"
              strokeWidth={0.8}
              cornerRadius={2}
              shadowColor="black"
              shadowBlur={3}
              shadowOffset={{ x: 0, y: 2 }}
              shadowOpacity={0.2}
            />
            {/* Tray opening slot (darker slit where wires enter) */}
            <Rect
              x={railX - 4}
              y={trayY + cableTrayHeight / 2 - 1.5}
              width={railWidth + 8}
              height={3}
              fill="#1f2937"
              cornerRadius={1}
            />
            {/* Tray mounting brackets on each side */}
            <Rect x={railX - 12} y={trayY + 3} width={4} height={cableTrayHeight - 6} fill="#4b5563" cornerRadius={0.5} />
            <Rect x={railX + railWidth + 8} y={trayY + 3} width={4} height={cableTrayHeight - 6} fill="#4b5563" cornerRadius={0.5} />
            {/* Vertical drop conduit from previous row's exit down into this tray */}
            {!hasNextRow && (
              <Rect
                x={railX - 8}
                y={trayY + cableTrayHeight}
                width={railWidth + 16}
                height={Math.max(20, earthBarY - (trayY + cableTrayHeight) - 12)}
                fill="#1f2937"
                cornerRadius={2}
                opacity={0.85}
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
                    strokeWidth={3.2}
                    lineCap="round"
                  />
                  <Line
                    points={[topX - 3, rY + 15, topX - 3, rY + 20]}
                    stroke={WIRE_COLORS.neutral}
                    strokeWidth={3.2}
                    lineCap="round"
                  />
                  {/* Phase terminal block (bornier à vis) above the component */}
                  <Group x={topX + 3} y={rY + 15}>
                    <Rect x={-3.2} y={-2.2} width={6.4} height={4.4} fill="#1f2937" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
                    <Line points={[-1.6, 0, 1.6, 0]} stroke="#fbbf24" strokeWidth={0.5} />
                    <Line points={[0, -1.4, 0, 1.4]} stroke="#fbbf24" strokeWidth={0.5} />
                  </Group>
                  {/* Neutral terminal block above the component */}
                  <Group x={topX - 3} y={rY + 20}>
                    <Rect x={-3.2} y={-2.2} width={6.4} height={4.4} fill="#0c4a6e" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
                    <Line points={[-1.6, 0, 1.6, 0]} stroke="#7dd3fc" strokeWidth={0.5} />
                    <Line points={[0, -1.4, 0, 1.4]} stroke="#7dd3fc" strokeWidth={0.5} />
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

        // Wire width proportional to section
        const wireWidth = Math.max(2.5, Math.min(6, props.cableSectionMm2 * 0.6));

        // Destination for load wires: loop out of breaker and go down to the base
        const destY = bottomY + 60;
        const destX = bottomX + (idx % 2 === 0 ? 12 : -12); // Spread destinations

        // Add a slight random offset to points of control for a hand-cabled feel
        const randOffset = (idx % 3 - 1) * 6;

        return (
          <Group key={`wires-load-${c.id}`}>
            {/* Neutral Wire (Light Blue) */}
            <Path
              data={drawBezierPath(bottomX - 2.5, bottomY, destX - 1.5, destY, 30, randOffset)}
              stroke={WIRE_COLORS.neutral}
              strokeWidth={wireWidth}
              lineCap="round"
            />
            {/* Neutral Terminal blocks (bornes à vis) at both ends */}
            <Group x={bottomX - 2.5} y={bottomY + 1}>
              <Rect x={-3.2} y={-2.2} width={6.4} height={4.4} fill="#0c4a6e" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
              <Line points={[-1.6, 0, 1.6, 0]} stroke="#7dd3fc" strokeWidth={0.5} />
              <Line points={[0, -1.4, 0, 1.4]} stroke="#7dd3fc" strokeWidth={0.5} />
            </Group>
            <Group x={destX - 1.5} y={destY}>
              <Rect x={-3.2} y={-2.2} width={6.4} height={4.4} fill="#0c4a6e" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
              <Line points={[-1.6, 0, 1.6, 0]} stroke="#7dd3fc" strokeWidth={0.5} />
              <Line points={[0, -1.4, 0, 1.4]} stroke="#7dd3fc" strokeWidth={0.5} />
            </Group>

            {/* Phase Wire (Brown or Black) */}
            <Path
              data={drawBezierPath(bottomX + 2.5, bottomY, destX + 1.5, destY, 35, randOffset + 4)}
              stroke={props.voltageV === 400 ? WIRE_COLORS.phaseTri : WIRE_COLORS.phase}
              strokeWidth={wireWidth}
              lineCap="round"
            />
            {/* Phase Terminal blocks at both ends */}
            <Group x={bottomX + 2.5} y={bottomY + 1}>
              <Rect x={-3.2} y={-2.2} width={6.4} height={4.4} fill="#1f2937" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
              <Line points={[-1.6, 0, 1.6, 0]} stroke="#fbbf24" strokeWidth={0.5} />
              <Line points={[0, -1.4, 0, 1.4]} stroke="#fbbf24" strokeWidth={0.5} />
            </Group>
            <Group x={destX + 1.5} y={destY}>
              <Rect x={-3.2} y={-2.2} width={6.4} height={4.4} fill="#1f2937" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
              <Line points={[-1.6, 0, 1.6, 0]} stroke="#fbbf24" strokeWidth={0.5} />
              <Line points={[0, -1.4, 0, 1.4]} stroke="#fbbf24" strokeWidth={0.5} />
            </Group>

            {/* Earth Wire (Yellow/Green alternating striped representation) */}
            {/* We draw a yellow curve, then a dashed green curve on top of it */}
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
            {/* Earth terminal block at the component end */}
            <Group x={bottomX} y={bottomY + 4}>
              <Rect x={-3.2} y={-2.2} width={6.4} height={4.4} fill="#15803d" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
              <Line points={[-1.6, 0, 1.6, 0]} stroke="#fde047" strokeWidth={0.5} />
              <Line points={[0, -1.4, 0, 1.4]} stroke="#fde047" strokeWidth={0.5} />
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
                      {/* Inter-row neutral terminal block (bornier) */}
                      <Group x={targetTerminals.topX - 3} y={targetTerminals.topY}>
                        <Rect x={-3.4} y={-2.4} width={6.8} height={4.8} fill="#0c4a6e" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
                        <Line points={[-1.6, 0, 1.6, 0]} stroke="#7dd3fc" strokeWidth={0.5} />
                        <Line points={[0, -1.4, 0, 1.4]} stroke="#7dd3fc" strokeWidth={0.5} />
                      </Group>
                      {/* Inter-row phase terminal block (bornier) */}
                      <Group x={targetTerminals.topX + 3} y={targetTerminals.topY}>
                        <Rect x={-3.4} y={-2.4} width={6.8} height={4.8} fill="#1f2937" stroke="#000" strokeWidth={0.4} cornerRadius={0.6} />
                        <Line points={[-1.6, 0, 1.6, 0]} stroke="#fbbf24" strokeWidth={0.5} />
                        <Line points={[0, -1.4, 0, 1.4]} stroke="#fbbf24" strokeWidth={0.5} />
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

