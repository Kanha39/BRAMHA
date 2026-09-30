let cancelHandler: () => void = () => undefined;

export function registerDemoCancellation(handler: () => void) {
  cancelHandler = handler;
}

export function cancelRegisteredDemo() {
  cancelHandler();
}
