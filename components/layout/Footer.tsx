import { LogoWordmark } from "./Logo";

/**
 * Footer. Carries the capability disclaimer that must stay visible everywhere:
 * WaterLens infers from evidence, it does not test water.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="text-muted">
          <LogoWordmark className="text-foreground" />
          <p className="mt-2 max-w-md text-[0.8125rem]">
            WaterLens interprets visible evidence, geographic context and public
            records. It is not a laboratory test and cannot confirm water safety.
          </p>
        </div>
        <p className="text-[0.8125rem] text-subtle">
          Geographic data ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            className="underline decoration-line-strong underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noreferrer noopener"
          >
            OpenStreetMap
          </a>{" "}
          contributors
        </p>
      </div>
    </footer>
  );
}
