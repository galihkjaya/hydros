import { LogoWordmark } from "./Logo";

/**
 * Footer. Carries the capability disclaimer that must stay visible everywhere:
 * Hydros infers from evidence, it does not test water. Plus OneAquaHealth /
 * IEEE / EU attribution and the license line.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t-2 border-ink">
      <div className="mx-auto grid max-w-[1180px] gap-6 px-6 py-8 sm:grid-cols-2 sm:px-10">
        <div className="text-ink-muted">
          <LogoWordmark className="text-ink" />
          <p className="mt-2 max-w-md text-[0.8125rem]">
            Hydros interprets visible evidence, geographic context and public
            records. It is not a laboratory test and cannot confirm water
            safety.
          </p>
          <p className="mt-3 font-mono text-[0.6875rem] tracking-wider uppercase">
            Hydros · OneAquaHealth IEEE Global Hackathon 2026
          </p>
        </div>
        <div className="text-[0.8125rem] text-ink-faint sm:text-right">
          <p>
            Geographic data ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="underline underline-offset-4 hover:text-ink"
              target="_blank"
              rel="noreferrer noopener"
            >
              OpenStreetMap
            </a>{" "}
            contributors
          </p>
          <p className="mt-2">
            Built for the OneAquaHealth project · IEEE · Co-funded by the
            European Union
          </p>
          <p className="mt-2 font-mono">
            <a
              href="https://github.com/galihkjaya/waterlens"
              className="underline underline-offset-4 hover:text-ink"
              target="_blank"
              rel="noreferrer noopener"
            >
              Repository
            </a>{" "}
            · MIT License
          </p>
        </div>
      </div>
    </footer>
  );
}
