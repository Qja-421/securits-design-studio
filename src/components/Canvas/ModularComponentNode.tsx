import React from 'react';
import { Group, Rect, Text, Circle, Line } from 'react-konva';
import { ElectricalComponent } from '../../types/electrical';
import { resolveBrand } from '../../types/brand';

interface ModularComponentNodeProps {
  component: ElectricalComponent;
  x: number;
  y: number;
  height: number;
  moduleWidthPx: number; // Width of a single module in pixels (e.g., 40px)
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: any) => void;
  onDragEnd: (e: any) => void;
}

export const ModularComponentNode: React.FC<ModularComponentNodeProps> = ({
  component,
  x,
  y,
  height,
  moduleWidthPx,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd
}) => {
  const { type, widthModules } = component;
  const props = component.properties;
  const width = widthModules * moduleWidthPx;

  // Brand-aware theme
  const brand = resolveBrand(props.brand);
  const isDiff = type === 'differential';
  const isGeneral = type === 'general_protection';
  const isBreaker = type === 'breaker';
  const isON = true; // Simulated ON status

  // Brand-specific colors
  const fills = isGeneral
    ? ['#3d3d3a', '#262624'] // General protection (VISTOP / iSW) keeps a dark body
    : brand.bodyGradient;
  const textColor = isGeneral ? '#ffffff' : '#1a1a1a';

  return (
    <Group
      x={x}
      y={y}
      width={width}
      height={height}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
    >
      {/* 3D Moulded Plastic Box Base — brand gradient */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: height }}
        fillLinearGradientColorStops={[
          0, fills[0],
          0.05, fills[0],
          0.95, fills[1],
          1, isGeneral ? '#1a1a1a' : brand.bodyShadow
        ]}
        stroke={isSelected ? '#F7941D' : '#8a8a80'}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={4}
        shadowColor="black"
        shadowBlur={6}
        shadowOffset={{ x: 2, y: 4 }}
        shadowOpacity={0.25}
      />

      {/* Top and Bottom Terminal Cavities (Câblage slots) */}
      <Rect x={width / 2 - 6} y={3} width={12} height={8} fill="#2c2c2a" cornerRadius={1} />
      <Line points={[width / 2 - 4, 7, width / 2 + 4, 7]} stroke="#777" strokeWidth={1} />
      <Rect x={width / 2 - 6} y={height - 11} width={12} height={8} fill="#2c2c2a" cornerRadius={1} />
      <Line points={[width / 2 - 4, height - 7, width / 2 + 4, height - 7]} stroke="#777" strokeWidth={1} />

      {/* Fixing Screws (realistic metal pins) */}
      <Circle x={8} y={8} radius={2.5} fill="#9ca3af" stroke="#4b5563" strokeWidth={0.5} />
      <Line points={[6.5, 8, 9.5, 8]} stroke="#374151" strokeWidth={0.5} />
      <Circle x={width - 8} y={height - 8} radius={2.5} fill="#9ca3af" stroke="#4b5563" strokeWidth={0.5} />
      <Line points={[width - 9.5, height - 8, width - 6.5, height - 8]} stroke="#374151" strokeWidth={0.5} />

      {/* Front Plate Faceplate (Inner module boundary) — brand-specific */}
      <Rect
        x={2}
        y={15}
        width={width - 4}
        height={height - 30}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: height - 30 }}
        fillLinearGradientColorStops={[0, brand.frontPlateGradient[0], 1, brand.frontPlateGradient[1]]}
        stroke="#dcdcd6"
        strokeWidth={1}
        cornerRadius={2}
      />

      {/* General protection specific design (VISTOP / iSW dark front plate) */}
      {isGeneral && (
        <Rect x={2} y={15} width={width - 4} height={height - 30} fill="#1c1c1a" stroke="#333" strokeWidth={1} cornerRadius={2} />
      )}

      {/* Top brand stripe — visible signature per brand */}
      <Rect
        x={2}
        y={15}
        width={width - 4}
        height={3}
        fill={brand.brandStripeColor}
        cornerRadius={[2, 2, 0, 0]}
      />

      {/* Brand Name Label — printed on the front plate */}
      <Text
        x={4}
        y={20}
        width={width - 8}
        text={isGeneral ? 'Securits' : brand.shortName}
        fontFamily="sans-serif"
        fontSize={width > 50 ? 7.5 : 6.5}
        fontStyle="bold"
        fill={isGeneral ? brand.brandStripeColor : brand.brandLabelColor}
        align="center"
      />

      {/* Product Reference Number — brand-specific family code */}
      <Text
        x={4}
        y={30}
        width={width - 8}
        text={brand.referenceByType[type] || brand.referencePrefix}
        fontFamily="monospace"
        fontSize={6}
        fill={isGeneral ? '#999' : '#666'}
        align="center"
      />

      {/* Technical Ratings — calibre In */}
      <Text
        x={4}
        y={38}
        width={width - 8}
        text={isDiff ? `${props.ratingA}A` : (isGeneral ? `${props.ratingA}A` : `${props.curve || 'C'}${props.ratingA}`)}
        fontFamily="sans-serif"
        fontSize={9.5}
        fontStyle="bold"
        fill={textColor}
        align="center"
      />

      {/* Voltage */}
      <Text
        x={4}
        y={height - 38}
        width={width - 8}
        text={props.poles === '4P' ? '400V~' : '230V~'}
        fontFamily="sans-serif"
        fontSize={6.5}
        fill={isGeneral ? '#999' : '#888'}
        align="center"
      />

      {/* Differential sensitivity type banner */}
      {isDiff && (
        <Group x={4} y={48} width={width - 8}>
          <Text
            x={0}
            y={0}
            width={width - 8}
            text={props.sensitivity}
            fontFamily="sans-serif"
            fontSize={7}
            fontStyle="bold"
            fill="#d97706"
            align="center"
          />
          <Rect
            x={width / 2 - 12}
            y={9}
            width={16}
            height={7}
            fill="#ef4444"
            cornerRadius={1.5}
          />
          <Text
            x={0}
            y={9.5}
            width={width - 8}
            text={props.diffType || 'AC'}
            fontFamily="sans-serif"
            fontSize={5.5}
            fontStyle="bold"
            fill="#fff"
            align="center"
          />
        </Group>
      )}

      {/* ON/OFF Bascule Switch — brand-colored ON state */}
      <Group x={width / 2 - 5} y={height / 2 - 12}>
        <Rect x={-2} y={-4} width={14} height={28} fill="#262624" stroke="#444" strokeWidth={0.5} cornerRadius={2} />
        <Rect
          x={0}
          y={isON ? 0 : 10}
          width={10}
          height={14}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: 0, y: 14 }}
          fillLinearGradientColorStops={[
            0, isON ? brand.rockerOnColor[0] : brand.rockerOffColor[0],
            1, isON ? brand.rockerOnColor[1] : brand.rockerOffColor[1]
          ]}
          stroke="#111"
          strokeWidth={0.5}
          cornerRadius={1.5}
          shadowColor="black"
          shadowBlur={2}
          shadowOffset={{ x: 0, y: isON ? 2 : -2 }}
          shadowOpacity={0.4}
        />
        <Line points={[1, isON ? 4 : 14, 9, isON ? 4 : 14]} stroke="#fff" strokeWidth={1} opacity={0.5} />
        <Line points={[1, isON ? 7 : 17, 9, isON ? 7 : 17]} stroke="#fff" strokeWidth={1} opacity={0.5} />
        <Text
          x={-15}
          y={isON ? 2 : 12}
          text={isON ? 'I-ON' : 'O-OFF'}
          fontSize={5.5}
          fontFamily="monospace"
          fill={isON ? brand.brandStripeColor : '#ef4444'}
          fontStyle="bold"
        />
      </Group>

      {/* Differential Pink Test Button */}
      {isDiff && (
        <Group x={width - 15} y={height / 2 - 6}>
          <Circle
            x={0}
            y={0}
            radius={5.5}
            fillLinearGradientStartPoint={{ x: -4, y: -4 }}
            fillLinearGradientEndPoint={{ x: 4, y: 4 }}
            fillLinearGradientColorStops={[0, '#ec4899', 1, '#be185d']}
            stroke="#9d174d"
            strokeWidth={0.5}
            shadowColor="black"
            shadowBlur={1}
            shadowOffset={{ x: 0, y: 1 }}
            shadowOpacity={0.3}
          />
          <Text
            x={-3}
            y={-3.5}
            text="T"
            fontFamily="sans-serif"
            fontSize={7}
            fontStyle="bold"
            fill="#ffffff"
          />
        </Group>
      )}

      {/* Visualization glass window (breakers only) */}
      {isBreaker && (
        <Rect
          x={width / 2 - 12}
          y={height - 24}
          width={24}
          height={6}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="#93c5fd"
          strokeWidth={0.5}
          cornerRadius={0.5}
        />
      )}

      {/* LED indicator (Parafoudre) */}
      {isGeneral && component.properties.name.includes('Parafoudre') && (
        <Group x={width / 2 - 6} y={height - 24}>
          <Rect
            x={0}
            y={0}
            width={12}
            height={6}
            fill="#10b981"
            stroke="#059669"
            strokeWidth={0.5}
          />
        </Group>
      )}
    </Group>
  );
};
