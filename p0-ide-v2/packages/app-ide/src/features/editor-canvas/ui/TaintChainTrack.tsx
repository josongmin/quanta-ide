import type { TaintChain } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  chain: TaintChain;
}

export function TaintChainTrack({ chain }: Props) {
  return (
    <>
      {/* Track label */}
      <div
        className="taint-chain__label"
        style={{ left: chain.nodes[0]?.x ?? 0, top: chain.y - 22 }}
      >
        <span className={cn("taint-chain__sev", `taint-chain__sev--${chain.severity}`)}>
          sev {chain.severity}
        </span>
        {chain.owasp && <span className="taint-chain__owasp">{chain.owasp}</span>}
      </div>

      {/* Chain nodes */}
      {chain.nodes.map((node) => (
        <div
          key={node.id}
          className={cn("taint-chain__node", `taint-chain__node--${node.kind}`)}
          style={{ left: node.x, top: node.y, width: node.w }}
        >
          <div className="taint-chain__node-head">
            <span className={cn("taint-chain__hop", `taint-chain__hop--${node.kind}`)}>
              {node.kind}
            </span>
            <span className="taint-chain__symbol">{node.symbol}</span>
          </div>
          {node.detail && <div className="taint-chain__detail">{node.detail}</div>}
          {node.ownerFn && <div className="taint-chain__fn">in {node.ownerFn}()</div>}
          {node.file && <div className="taint-chain__file">{node.file}</div>}
        </div>
      ))}
    </>
  );
}
