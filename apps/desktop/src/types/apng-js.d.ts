declare module "apng-js" {
  interface APNGFrame {
    width: number;
    height: number;
    left: number;
    top: number;
    delay: number;
    disposeOp: number;
    blendOp: number;
    imageData: Blob | null;
    imageElement: HTMLImageElement | null;
  }

  interface Player {
    play(): void;
    pause(): void;
    stop(): void;
    renderNextFrame(): void;
    currentFrameNumber: number;
  }

  interface APNG {
    width: number;
    height: number;
    numPlays: number;
    playTime: number;
    frames: APNGFrame[];
    getPlayer(
      context: CanvasRenderingContext2D,
      autoPlay?: boolean
    ): Promise<Player>;
  }

  function parseAPNG(buffer: ArrayBuffer): APNG | Error;

  export default parseAPNG;
}
