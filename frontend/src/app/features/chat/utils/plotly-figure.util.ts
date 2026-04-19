import type { VisualizationResponse } from '../models/chat.models';

export interface PlotlyFigureInput {
  data: Record<string, unknown>[];
  layout?: Record<string, unknown>;
}

const figureCache = new WeakMap<VisualizationResponse, PlotlyFigureInput | null>();

export function extractPlotlyFigure(v?: VisualizationResponse | null): PlotlyFigureInput | null {
  if (!v) {
    return null;
  }
  const cached = figureCache.get(v);
  if (cached !== undefined) {
    return cached;
  }
  if (!v.data || typeof v.data !== 'object') {
    figureCache.set(v, null);
    return null;
  }
  const raw = v.data as Record<string, unknown>;
  const plotly = raw['plotly'] as Record<string, unknown> | undefined;
  if (plotly && Array.isArray(plotly['data']) && plotly['data'].length > 0) {
    const figure = {
      data: plotly['data'] as Record<string, unknown>[],
      layout: plotly['layout'] as Record<string, unknown> | undefined,
    };
    figureCache.set(v, figure);
    return figure;
  }
  if (Array.isArray(raw['data']) && raw['data'].length > 0) {
    const figure = {
      data: raw['data'] as Record<string, unknown>[],
      layout: raw['layout'] as Record<string, unknown> | undefined,
    };
    figureCache.set(v, figure);
    return figure;
  }
  const inner = raw['visualization'] as Record<string, unknown> | undefined;
  if (inner && Array.isArray(inner['data']) && inner['data'].length > 0) {
    const figure = {
      data: inner['data'] as Record<string, unknown>[],
      layout: inner['layout'] as Record<string, unknown> | undefined,
    };
    figureCache.set(v, figure);
    return figure;
  }
  figureCache.set(v, null);
  return null;
}

export function hasRenderableVisualization(v?: VisualizationResponse | null): boolean {
  return extractPlotlyFigure(v) != null;
}
