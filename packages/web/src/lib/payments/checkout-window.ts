export function openCheckoutWindow(): Window | null {
  const checkoutWindow = window.open("about:blank", "_blank");
  if (checkoutWindow) checkoutWindow.opener = null;
  return checkoutWindow;
}

export function navigateCheckoutWindow(checkoutWindow: Window | null, checkoutUrl: string): void {
  if (checkoutWindow && !checkoutWindow.closed) {
    checkoutWindow.location.replace(checkoutUrl);
    return;
  }
  window.location.assign(checkoutUrl);
}

export function closeCheckoutWindow(checkoutWindow: Window | null): void {
  if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();
}
