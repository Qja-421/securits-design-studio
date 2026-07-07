// Local TypeScript shim for Firebase v12 submodules whose built-in
// .d.ts files don't expose the conventional subpath imports we use
// in this project. Keeps the rest of the code working without
// having to refactor firebase imports everywhere.
declare module 'firebase/app' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const initializeApp: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getApp: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getApps: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type FirebaseOptions = any;
}

declare module 'firebase/firestore' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getFirestore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const doc: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getDoc: any;
  // Firebase ships Timestamp as a class so the same identifier is used
  // both as a value (instanceof check) and as a type. We mirror that
  // here with a class declaration; `any` lets every property access pass
  // through type checking.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class Timestamp {
    constructor(...args: any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static [Symbol.hasInstance]: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
}
