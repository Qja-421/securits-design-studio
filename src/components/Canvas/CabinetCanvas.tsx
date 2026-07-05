import React, { useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle } from 'react-konva';
import { useProjectStore } from '../../store/projectStore';
import { ModularComponentNode } from './ModularComponentNode';
import { CablingRenderer } from './CablingRenderer';

interface CabinetCanvasProps {
  zoom: number;
  setZoom: (z: number) => void;
  presentationMode: boolean;
}

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

  // Position parameters based on DIN proportions.
  const scalePxPerMm = 2;
  const moduleWidthPx = 17.5 * scalePxPerMm;
  const dinRailHeight = 35 * scalePxPerMm;
  const componentHeight = 110;
  const rowWiringGap = 75;
  const rowSpacing = componentHeight + rowWiringGap;
  const topOffset = 80;
  const paddingX = 55;
  const railX = paddingX;
  const railWidth = activeCabinet ? activeCabinet.modulesPerRow * moduleWidthPx : 18 * moduleWidthPx;
  const cabinetWidth = railWidth + paddingX * 2;

  // Track position of rows dynamically
  const getRailYPositions = () => {
    if (!activeCabinet) return [];
    return Array.from({ length: activeCabinet.rowsCount }).map(
      (_, i) => topOffset + i * rowSpacing
    );
  };

  const railYPositions = getRailYPositions();

  // Dimensions of overall enclosure
  const getCabinetHeight = () => {
    if (!activeCabinet) return 400;
    return topOffset + activeCabinet.rowsCount * componentHeight + (activeCabinet.rowsCount - 1) * rowWiringGap + 95;
  };

  const cabinetHeight = getCabinetHeight();

  // Drag and Drop from HTML5 sidebar into Konva drop-zone
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!activeCabinet || !stageRef.current) return;

    try {
      const dragDataStr = e.dataTransfer.getData('application/react-coffret-component');
      if (!dragDataStr) return;
      const dragData = JSON.parse(dragDataStr);

      // Map screen coords to stage coords accounting for zoom & pan
      const stage = stageRef.current;
      const stageBox = stage.container().getBoundingClientRect();
      const rawX = e.clientX - stageBox.left;
      const rawY = e.clientY - stageBox.top;

      const scale = stage.scaleX();
      const sX = stage.x();
      const sY = stage.y();

      const canvasX = (rawX - sX) / scale;
      const canvasY = (rawY - sY) / scale;

      // Find closest row
      const yDiffs = railYPositions.map((y) => Math.abs(canvasY - (y + 15)));
      const closestRowIdx = yDiffs.indexOf(Math.min(...yDiffs));

      // Find closest module slot
      const relativeX = canvasX - railX;
      const slot = Math.max(0, Math.round(relativeX / moduleWidthPx));

      // Trigger drop insert
      addComponent(activeCabinetId, {
        id: 'comp_' + Math.random().toString(36).substr(2, 9),
        type: dragData.type,
        widthModules: dragData.widthModules,
        rowIndex: closestRowIdx,
        properties: dragData.properties
      });
    } catch (err) {
      console.error("Drop handling failed", err);
    }
  };

  // Snapping logic when drag/moving elements inside the canvas
  const handleComponentDragEnd = (e: any, compId: string) => {
    if (!activeCabinet) return;
    const node = e.target;
    
    // Node position in local coordinates relative to parent layer
    const dragX = node.x();
    const dragY = node.y();

    // Map closest row
    const rowIdx = Math.max(
      0,
      Math.min(
        activeCabinet.rowsCount - 1,
        Math.round((dragY - topOffset) / rowSpacing)
      )
    );

    // Map closest module slot
    const slotIdx = Math.max(
      0,
      Math.min(
        activeCabinet.modulesPerRow - (node.width() / moduleWidthPx),
        Math.round((dragX - railX) / moduleWidthPx)
      )
    );

    // Call state update
    const moved = moveComponent(activeCabinetId, compId, rowIdx, slotIdx);

    // Reset node positions so Konva draws them where state says they belong
    const targetRowY = railYPositions[rowIdx] + 15;
    const targetColX = railX + slotIdx * moduleWidthPx;
    node.x(targetColX);
    node.y(targetRowY);
    node.getLayer().batchDraw();

    if (!moved) {
      // Force reload if collision detected (Zustand will block and this resets visual)
      selectComponent(null);
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative w-full h-full overflow-hidden flex items-center justify-center transition-all ${
        presentationMode 
          ? 'bg-gradient-to-tr from-[#141413] via-[#222220] to-[#1e1e1d]' 
          : 'bg-[#e5e7eb] bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:16px_16px]'
      }`}
      onClick={() => selectComponent(null)}
    >
      {/* Visual Mode Label */}
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
        y={40}
        draggable
      >
        <Layer>
          {/* ----------------------------------------------------
              1. CABINET ENCLOSURE OUTER SHELL
              ---------------------------------------------------- */}
          {/* Main metallic backplate box */}
          <Rect
            x={10}
            y={10}
            width={cabinetWidth - 20}
            height={cabinetHeight - 20}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: cabinetWidth, y: cabinetHeight }}
            fillLinearGradientColorStops={[
              0, presentationMode ? '#F0ECE3' : '#374151',
              1, presentationMode ? '#e5e0d3' : '#1f2937'
            ]}
            stroke={presentationMode ? '#bcbcb4' : '#4b5563'}
            strokeWidth={8}
            cornerRadius={8}
            shadowColor="black"
            shadowBlur={20}
            shadowOffset={{ x: 5, y: 10 }}
            shadowOpacity={0.35}
          />

          {/* Corner Screws for metallic cover realism */}
          {[
            { cx: 25, cy: 25 },
            { cx: cabinetWidth - 25, cy: 25 },
            { cx: 25, cy: cabinetHeight - 25 },
            { cx: cabinetWidth - 25, cy: cabinetHeight - 25 }
          ].map((screw, sIdx) => (
            <Group key={`screw-${sIdx}`}>
              <Circle
                x={screw.cx}
                y={screw.cy}
                radius={6}
                fillLinearGradientStartPoint={{ x: -3, y: -3 }}
                fillLinearGradientEndPoint={{ x: 3, y: 3 }}
                fillLinearGradientColorStops={[0, '#e5e7eb', 1, '#6b7280']}
                stroke="#4b5563"
                strokeWidth={1}
              />
              <Line
                points={[screw.cx - 4, screw.cy, screw.cx + 4, screw.cy]}
                stroke="#374151"
                strokeWidth={1.5}
                rotation={sIdx * 45}
              />
            </Group>
          ))}

          {/* ----------------------------------------------------
              2. DIN RAILS & RACKS (Only in Atelier Mode)
              ---------------------------------------------------- */}
          {!presentationMode &&
            railYPositions.map((y, rIdx) => (
              <Group key={`rail-din-${rIdx}`}>
                {/* Horizontal DIN Rail bracket (Metallic shape) */}
                <Rect
                  x={railX - 10}
                  y={y + 35}
                  width={railWidth + 20}
                  height={dinRailHeight}
                  fillLinearGradientStartPoint={{ x: 0, y: y + 35 }}
                  fillLinearGradientEndPoint={{ x: 0, y: y + 35 + dinRailHeight }}
                  fillLinearGradientColorStops={[
                    0, '#9ca3af',
                    0.2, '#d1d5db',
                    0.5, '#e5e7eb',
                    0.8, '#9ca3af',
                    1, '#4b5563'
                  ]}
                  stroke="#4b5563"
                  strokeWidth={0.5}
                  shadowColor="black"
                  shadowBlur={2}
                  shadowOffset={{ x: 0, y: 2 }}
                  shadowOpacity={0.15}
                />
                {/* Slot holes along the rails */}
                {Array.from({ length: Math.max(1, Math.floor(railWidth / 30)) }).map((_, slotIdx) => (
                  <Rect
                    key={`slot-${slotIdx}`}
                    x={railX + slotIdx * 30 + 10}
                    y={y + 48}
                    width={10}
                    height={8}
                    fill="#374151"
                    cornerRadius={1}
                  />
                ))}
              </Group>
            ))}

          {/* ----------------------------------------------------
              3. WIRING AND CABLING LAYER
              ---------------------------------------------------- */}
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

          {/* ----------------------------------------------------
              4. MODULAR COMPONENTS (Placed on Rails)
              ---------------------------------------------------- */}
          {activeCabinet && !presentationMode &&
            activeCabinet.components.map((comp) => {
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

          {/* ----------------------------------------------------
              5. PRESENTATION MODE COVER PLATES (Façade Blanche)
              ---------------------------------------------------- */}
          {presentationMode && activeCabinet && (
            <Group>
              {/* White ABS Plastic Cover Plate Overlay */}
              <Rect
                x={20}
                y={20}
                width={cabinetWidth - 40}
                height={cabinetHeight - 40}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: 0, y: cabinetHeight }}
                fillLinearGradientColorStops={[
                  0, '#ffffff',
                  0.3, '#ffffff',
                  1, '#f3f4f6'
                ]}
                stroke="#d1d5db"
                strokeWidth={1}
                cornerRadius={4}
              />

              {/* Rows Slot Windows (Fenêtres découpées) */}
              {railYPositions.map((y, rowIndex) => {
                const rowComponents = activeCabinet.components.filter(
                  (c) => c.rowIndex === rowIndex
                );

                // For presentation mode, show nice printed labels on top of the slot
                return (
                  <Group key={`cover-row-${rowIndex}`}>
                    {/* Dark cut-out window backing */}
                    <Rect
                      x={railX}
                      y={y + 15}
                      width={railWidth}
                      height={componentHeight}
                      fill="#374151"
                      stroke="#1f2937"
                      strokeWidth={2}
                      cornerRadius={2}
                      shadowColor="black"
                      shadowBlur={4}
                      shadowOffset={{ x: 0, y: 2 }}
                      shadowOpacity={0.5}
                    />

                    {/* Renders components inside window */}
                    {rowComponents.map((comp) => {
                      const colX = railX + comp.moduleIndex * moduleWidthPx;
                      const isSelected = selectedComponentId === comp.id;
                      
                      return (
                        <ModularComponentNode
                          key={comp.id}
                          component={comp}
                          x={colX}
                          y={y + 15}
                          height={componentHeight}
                          moduleWidthPx={moduleWidthPx}
                          isSelected={isSelected}
                          onSelect={() => selectComponent(comp.id)}
                          onDragStart={() => {}}
                          onDragEnd={() => {}}
                        />
                      );
                    })}

                    {/* Window filler covers (obturateurs) in the empty spaces */}
                    {/* Renders a nice grooved plastic cover where there are no modules */}
                    <Group>
                      {/* Simplification: we draw plastic groves around the slot window */}
                      <Line
                        points={[railX, y - 10, railX + railWidth, y - 10]}
                        stroke="#e5e7eb"
                        strokeWidth={4}
                      />
                    </Group>

                    {/* Circuit Labels Strip (Bandeau d'étiquettes de repérage) */}
                    {/* Sits right below the breakers row */}
                    <Rect
                      x={railX}
                      y={y + componentHeight + 18}
                      width={railWidth}
                      height={20}
                      fill="#ffffff"
                      stroke="#cbd5e1"
                      strokeWidth={1}
                      cornerRadius={1.5}
                    />

                    {/* Small divider ticks between labels */}
                    {Array.from({ length: activeCabinet.modulesPerRow + 1 }).map((_, tickIdx) => (
                      <Line
                        key={`tick-${tickIdx}`}
                        points={[
                          railX + tickIdx * moduleWidthPx,
                          y + componentHeight + 18,
                          railX + tickIdx * moduleWidthPx,
                          y + componentHeight + 38
                        ]}
                        stroke="#cbd5e1"
                        strokeWidth={0.5}
                      />
                    ))}

                    {/* Print text labels corresponding to each component load */}
                    {rowComponents.map((comp) => {
                      const labelX = railX + comp.moduleIndex * moduleWidthPx;
                      const labelW = comp.widthModules * moduleWidthPx;

                      return (
                        <Text
                          key={`label-text-${comp.id}`}
                          x={labelX + 2}
                          y={y + componentHeight + 24}
                          width={labelW - 4}
                          text={comp.properties.name}
                          fontFamily="sans-serif"
                          fontSize={6.5}
                          fontStyle="bold"
                          fill="#475569"
                          align="center"
                          ellipsis
                          wrap="none"
                        />
                      );
                    })}
                  </Group>
                );
              })}

              {/* Glossy Overlay highlight (simulating reflective door panel glass) */}
              <Rect
                x={20}
                y={20}
                width={cabinetWidth - 40}
                height={cabinetHeight - 40}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: cabinetWidth - 40, y: cabinetHeight - 40 }}
                fillLinearGradientColorStops={[
                  0, 'rgba(255, 255, 255, 0.15)',
                  0.4, 'rgba(255, 255, 255, 0.05)',
                  0.45, 'rgba(255, 255, 255, 0)',
                  1, 'rgba(255, 255, 255, 0)'
                ]}
                listening={false} // Click-through
              />
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  );
};
