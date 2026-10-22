import { ExecutionTrace } from '../types';

export function downloadJsonTrace(trace: ExecutionTrace) {
  const jsonStr = JSON.stringify(trace, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `execution_trace_${trace.language}_step${trace.totalSteps}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportElementSvg(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const svgElement = el.querySelector('svg');
  if (svgElement) {
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Fallback: create SVG container of DOM content
  const htmlContent = el.innerHTML;
  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${el.offsetWidth}" height="${el.offsetHeight}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif; color:white; background:#070a12; padding:20px;">
          ${htmlContent}
        </div>
      </foreignObject>
    </svg>
  `;
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
