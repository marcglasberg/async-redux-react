// The Esserializer code was copied and adapted from the original copyrighted work, MIT licensed, by cshao.
// All credit goes to him. See: https://www.npmjs.com/package/esserializer
// The Esserializer code was copied and adapted from the original copyrighted work, MIT licensed, by cshao.
// All credit goes to him. See: https://www.npmjs.com/package/esserializer

class Person {
  age: number;

  constructor(age: number) {
    this.age = age;
  }

  isOld(): boolean {
    return this.age > 60;
  }
}

export default Person;
