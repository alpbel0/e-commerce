declare module 'plotly.js-dist-min' {
  const Plotly: {
    newPlot: (
      root: HTMLElement,
      data: object[],
      layout?: object,
      config?: object
    ) => Promise<unknown>;
    purge: (root: HTMLElement) => void;
  };
  export default Plotly;
}
