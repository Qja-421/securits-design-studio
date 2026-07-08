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

/**
 * ModularComponentNode — Realistic-looking electrical module.
 *
 * Renders a photo-style breaker/diff/general-protection with:
 *   - Top + bottom screw terminals (visible chrome cross-head screws)
 *   - White ABS plastic front plate with multi-stop gradient
 *   - Brand stripe + brand name + reference number
 *   - Calibre label (C10/C16/C20/…) on the front plate
 *   - Rocker switch with I-ON / O-OFF markings (depth via inner shadow)
 *   - Test button (T) for differentials
 *   - Selection highlight
 */
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

  const brand = resolveBrand(props.brand);
  const isDiff = type === 'differential';
  const isGeneral = type === 'general_protection';
  const isBreaker = type === 'breaker';
  const isON = true;

  // ─── Color palette per type / brand ───
  // For differential: keep white body with brand colors (like real Hager/Schneider diffs)
  // For general protection (VISTOP / iSW): dark body to match real products
  const bodyGradient = isGeneral
    ? ['#3F3F46', '#27272A', '#0F172A'] as const
    : [brand.bodyGradient[0], '#FAFAF8', brand.bodyGradient[1]] as const;
  const bodyShadow = isGeneral ? '#000000' : brand.bodyShadow;
  const textColor = isGeneral ? '#FFFFFF' : '#1F2937';
  const accentColor = isGeneral ? '#F7941D' : brand.brandStripeColor;

  // Width-aware font scaling (so labels stay readable across 1/2/4 module widths)
  const fontScale = Math.min(1, Math.max(0.7, width / 35));
  const labelFont = (base: number) => base * fontScale;

  // Calibre text (e.g. "C16", "C20", "C32", "40A")
  const calibreText = isDiff
    ? `${props.ratingA}A`
    : isGeneral
      ? `${props.ratingA}A`
      : `${props.curve || 'C'}${props.ratingA}`;

  // Reference family (per brand theme, per type)
  const reference = brand.referenceByType[type] || brand.referencePrefix;

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
      {/* ── 1. Top screw terminal cavity ── */}
      {/* The plastic cavity that hosts the wire-clamping screw */}
      <Rect
        x={width / 2 - 9} y={2}
        width={18} height={11}
        fill="#1F2937"
        cornerRadius={1.2}
        shadowColor="black" shadowBlur={1} shadowOffset={{ x: 0, y: 0.6 }} shadowOpacity={0.5}
      />
      {/* Cross-head chrome screw */}
      <ChromeScrew cx={width / 2} cy={7.5} radius={3.2} />

      {/* ── 2. Brand stripe (thin colored band at top of front plate) ── */}
      <Rect
        x={1.5} y={14}
        width={width - 3} height={4.2}
        fill={brand.brandStripeColor}
        cornerRadius={[1.5, 1.5, 0, 0]}
      />
      {/* Highlight on the stripe top */}
      <Line
        points={[2, 14.6, width - 2, 14.6]}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={0.6}
      />

      {/* ── 3. Front plate body — multi-stop plastic gradient ── */}
      <Rect
        x={1.5} y={18.2}
        width={width - 3} height={height - 32}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: height - 32 }}
        fillLinearGradientColorStops={[
          0, bodyGradient[0],
          0.04, bodyGradient[0],
          0.5, bodyGradient[1],
          0.96, bodyGradient[2],
          1, bodyShadow
        ]}
        stroke={isSelected ? '#F7941D' : (isGeneral ? '#1F2937' : '#9CA3AF')}
        strokeWidth={isSelected ? 2 : 0.5}
        cornerRadius={[0, 0, 1.5, 1.5]}
        shadowColor="black" shadowBlur={2} shadowOffset={{ x: 0.5, y: 1 }} shadowOpacity={0.3}
      />

      {/* Inner recessed rim — like real breakers have a beveled front plate */}
      <Rect
        x={3.5} y={20.5}
        width={width - 7} height={height - 36}
        fill="none"
        stroke={isGeneral ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}
        strokeWidth={0.4}
        cornerRadius={1}
      />

      {/* ── 4. Brand name printed on front plate ── */}
      <Text
        x={3} y={22}
        width={width - 6}
        text={isGeneral ? 'SECURITS' : brand.shortName.toUpperCase()}
        fontSize={labelFont(6.5)}
        fontStyle="bold"
        fill={isGeneral ? '#F7941D' : brand.brandLabelColor}
        align="center"
        fontFamily="Inter, sans-serif"
      />

      {/* ── 5. Reference number (small monospace below brand) ── */}
      <Text
        x={3} y={29.5}
        width={width - 6}
        text={reference}
        fontSize={labelFont(5)}
        fontStyle="bold"
        fill={isGeneral ? 'rgba(255,255,255,0.7)' : '#64748B'}
        align="center"
        fontFamily="monospace"
      />

      {/* ── 6. Calibre label — large, prominent (the "C16" sticker look) ── */}
      <Rect
        x={3} y={36}
        width={width - 6} height={20}
        fill="rgba(255,255,255,0.55)"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth={0.4}
        cornerRadius={1}
      />
      <Text
        x={3} y={38.5}
        width={width - 6}
        text={calibreText}
        fontSize={labelFont(11)}
        fontStyle="bold"
        fill={isGeneral ? '#FFFFFF' : '#0F172A'}
        align="center"
        fontFamily="Inter, sans-serif"
      />

      {/* ── 7. Voltage label (230V / 400V) ── */}
      <Text
        x={3} y={height - 22}
        width={width - 6}
        text={props.poles === '4P' ? '400V~' : props.poles === '3P' ? '400V~' : '230V~'}
        fontSize={labelFont(5.5)}
        fill={isGeneral ? 'rgba(255,255,255,0.7)' : '#64748B'}
        align="center"
        fontFamily="monospace"
      />

      {/* ── 8. Differential extras ── */}
      {isDiff && (
        <Group>
          {/* 30mA sensitivity sticker */}
          <Rect
            x={3} y={height / 2 - 4}
            width={width - 6} height={9}
            fill="#0F172A"
            cornerRadius={1.2}
            shadowColor="black" shadowBlur={1} shadowOffset={{ x: 0, y: 0.5 }} shadowOpacity={0.4}
          />
          <Text
            x={3} y={height / 2 - 2}
            width={width - 6}
            text={props.sensitivity || '30mA'}
            fontSize={labelFont(6.5)}
            fontStyle="bold"
            fill="#FACC15"
            align="center"
            fontFamily="Inter, sans-serif"
          />
          {/* Type AC/A/Hpi mini badge below */}
          <Rect
            x={width / 2 - 9} y={height / 2 + 7}
            width={18} height={8}
            fill="#DC2626"
            cornerRadius={1.2}
            shadowColor="black" shadowBlur={0.5} shadowOpacity={0.3}
          />
          <Text
            x={width / 2 - 9} y={height / 2 + 8}
            width={18}
            text={props.diffType || 'AC'}
            fontSize={labelFont(5.5)}
            fontStyle="bold"
            fill="#FFFFFF"
            align="center"
            fontFamily="Inter, sans-serif"
          />
          {/* Test button (T) — round, magenta, on the right side */}
          <Circle
            x={width - 7} y={height / 2 - 8}
            radius={labelFont(4.5)}
            fillLinearGradientStartPoint={{ x: -3, y: -3 }}
            fillLinearGradientEndPoint={{ x: 3, y: 3 }}
            fillLinearGradientColorStops={[0, '#F472B6', 1, '#9D174D']}
            stroke="#831843" strokeWidth={0.4}
            shadowColor="black" shadowBlur={1} shadowOffset={{ x: 0, y: 0.6 }} shadowOpacity={0.5}
          />
          <Text
            x={width - 10} y={height / 2 - 11}
            text="T"
            fontSize={labelFont(5.5)}
            fontStyle="bold"
            fill="#FFFFFF"
            fontFamily="Inter, sans-serif"
          />
        </Group>
      )}

      {/* ── 9. Rocker switch (ON/OFF) with I-ON/O-OFF markings ── */}
      <Group x={width / 2 - 5.5} y={height / 2 - 9}>
        {/* Recessed slot */}
        <Rect
          x={-2.5} y={-5}
          width={16} height={32}
          fill="#0F172A"
          stroke="#1F2937"
          strokeWidth={0.4}
          cornerRadius={2.2}
          shadowColor="black" shadowBlur={1.5} shadowOffset={{ x: 0, y: 0.6 }} shadowOpacity={0.5}
        />
        {/* Inner highlight on the slot */}
        <Line points={[-1.8, -3.8, 13.2, -3.8]} stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
        {/* Rocker body — moved up when ON, down when OFF */}
        <Rect
          x={-0.2} y={isON ? 0 : 11}
          width={11} height={15}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: 0, y: 15 }}
          fillLinearGradientColorStops={[
            0, isON ? brand.rockerOnColor[0] : brand.rockerOffColor[0],
            1, isON ? brand.rockerOnColor[1] : brand.rockerOffColor[1]
          ]}
          stroke="#0F172A" strokeWidth={0.4}
          cornerRadius={1.5}
          shadowColor="black" shadowBlur={1.5} shadowOffset={{ x: 0, y: isON ? 1.2 : -1.2 }} shadowOpacity={0.45}
        />
        {/* Rocker ridges (texture lines) */}
        <Line points={[1, isON ? 4 : 15, 10, isON ? 4 : 15]} stroke="rgba(255,255,255,0.5)" strokeWidth={0.7} />
        <Line points={[1, isON ? 7 : 18, 10, isON ? 7 : 18]} stroke="rgba(255,255,255,0.5)" strokeWidth={0.7} />
        {/* I-ON label (left of the rocker, at the side it currently points to) */}
        <Text
          x={-9} y={isON ? 1.5 : 13}
          text="I-ON"
          fontSize={labelFont(4.5)}
          fontStyle="bold"
          fill={isON ? brand.brandStripeColor : '#94A3B8'}
          fontFamily="monospace"
        />
      </Group>

      {/* ── 10. Bottom screw terminal cavity ── */}
      <Rect
        x={width / 2 - 9} y={height - 13}
        width={18} height={11}
        fill="#1F2937"
        cornerRadius={1.2}
        shadowColor="black" shadowBlur={1} shadowOffset={{ x: 0, y: -0.4 }} shadowOpacity={0.5}
      />
      <ChromeScrew cx={width / 2} cy={height - 7.5} radius={3.2} />

      {/* ── 11. Two top fixing screws (small chrome phillips) ── */}
      <ChromeScrew cx={5} cy={4} radius={1.8} small />
      <ChromeScrew cx={width - 5} cy={4} radius={1.8} small />

      {/* ── 12. LED indicator for parafoudre ── */}
      {isGeneral && component.properties.name.includes('Parafoudre') && (
        <Rect
          x={width / 2 - 6} y={height - 30}
          width={12} height={5}
          fill="#10B981"
          stroke="#059669" strokeWidth={0.4}
          cornerRadius={0.6}
        />
      )}
    </Group>
  );
};

/**
 * ChromeScrew — small chrome phillips screw, used for terminal screws
 * and fixing screws. Self-contained Konva group.
 */
const ChromeScrew: React.FC<{ cx: number; cy: number; radius: number; small?: boolean }> = ({
  cx,
  cy,
  radius,
  small = false
}) => (
  <Group listening={false}>
    <Circle
      x={cx}
      y={cy}
      radius={radius}
      fillLinearGradientStartPoint={{ x: -radius, y: -radius }}
      fillLinearGradientEndPoint={{ x: radius, y: radius }}
      fillLinearGradientColorStops={[0, '#FFFFFF', 0.45, '#D1D5DB', 1, '#52525B']}
      stroke="#27272A" strokeWidth={0.3}
      shadowColor="black" shadowBlur={0.8} shadowOffset={{ x: 0, y: 0.3 }} shadowOpacity={0.55}
    />
    {/* Cross-head slot */}
    <Line
      points={[cx - radius * 0.65, cy, cx + radius * 0.65, cy]}
      stroke="#0F172A" strokeWidth={small ? 0.4 : 0.5}
    />
    <Line
      points={[cx, cy - radius * 0.65, cx, cy + radius * 0.65]}
      stroke="#0F172A" strokeWidth={small ? 0.4 : 0.5}
    />
  </Group>
);