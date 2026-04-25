import type { ShapeObject, TextObject, BarcodeObject } from '@burnmark-io/designer-core';
import type { useDesignerStore } from '@/stores/designer';

type DesignerStore = ReturnType<typeof useDesignerStore>;

/**
 * The sample label shown on first visit. A 62mm continuous label with a
 * greeting, a QR code, and a thin frame. Communicates "this is a label
 * tool" within one second.
 */
export function loadFirstVisitDocument(designer: DesignerStore): void {
  // 62mm × 40mm at 300dpi → 696 × 472 dots
  designer.setCanvas({
    widthDots: 696,
    heightDots: 472,
    dpi: 300,
  });

  // Outer frame
  designer.addObject<ShapeObject>({
    type: 'shape',
    shape: 'rectangle',
    x: 16,
    y: 16,
    width: 664,
    height: 440,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    fill: false,
    strokeWidth: 4,
    invert: false,
    cornerRadius: 18,
    name: 'Frame',
  });

  // Greeting
  designer.addObject<TextObject>({
    type: 'text',
    x: 60,
    y: 80,
    width: 480,
    height: 110,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    content: 'Hello {{name}}',
    fontFamily: 'Inter',
    fontSize: 88,
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: 'left',
    verticalAlign: 'top',
    letterSpacing: 0,
    lineHeight: 1.1,
    invert: false,
    wrap: true,
    autoHeight: false,
    name: 'Greeting',
  });

  // Subtitle
  designer.addObject<TextObject>({
    type: 'text',
    x: 60,
    y: 200,
    width: 380,
    height: 50,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    content: 'Welcome to burnmark',
    fontFamily: 'Inter',
    fontSize: 36,
    fontWeight: 'normal',
    fontStyle: 'italic',
    textAlign: 'left',
    verticalAlign: 'top',
    letterSpacing: 0,
    lineHeight: 1.2,
    invert: false,
    wrap: false,
    autoHeight: false,
    name: 'Subtitle',
  });

  // QR code
  designer.addObject<BarcodeObject>({
    type: 'barcode',
    x: 500,
    y: 280,
    width: 160,
    height: 160,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    format: 'qrcode',
    data: 'https://burnmark.io',
    options: { eclevel: 'M', scale: 4 },
    name: 'QR code',
  });

  designer.clearHistory();
  designer.deselect();
}
