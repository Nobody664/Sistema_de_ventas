export function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "Documento para impresión";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      frame.remove();
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("No se pudo cargar el documento para imprimir"));
    }, 20_000);
    frame.onload = () => {
      if (finished) return;
      try {
        const target = frame.contentWindow;
        if (!target)
          throw new Error("No se pudo abrir el documento para imprimir");
        clearTimeout(timeout);
        target.focus();
        target.print();
        resolve();
        window.setTimeout(cleanup, 1000);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
