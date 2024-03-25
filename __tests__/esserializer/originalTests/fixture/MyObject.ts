// The Esserializer code was copied and adapted from the original copyrighted work, MIT licensed, by cshao.
// All credit goes to him. See: https://www.npmjs.com/package/esserializer

export default class MyObject {
  property1: string | null;
  property2: string | null;

  constructor() {
    this.property1 = null;
    this.property2 = null;
    this.init();
  }

  init(): void {
    this.property1 = 'First';
    this.property2 = 'Second';
  }

  isInitialized(): boolean {
    return true;
  }
}
