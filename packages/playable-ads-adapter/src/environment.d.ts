export {}

declare global {
  declare module '*?worker' {
    var strPath: string;
    export default strPath
  }
}
