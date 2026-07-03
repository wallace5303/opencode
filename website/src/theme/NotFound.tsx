import Heading from "@theme/Heading"
import Link from "@docusaurus/Link"
import type { ReactNode } from "react"

// 覆盖 @theme/NotFound（theme-classic 默认 404）。无需 swizzle 命令，
// 放在 src/theme/ 下即自动生效。
export default function NotFound(): ReactNode {
  return (
    <main className="container margin-vert--xl">
      <div className="row">
        <div className="col col--6 col--offset-3 text--center">
          <Heading as="h1" className="hero__title">
            404
          </Heading>
          <p className="hero__subtitle">这页不在文档里——可能被改名或移动了。</p>
          <div className="margin-vert--lg">
            <Link className="button button--primary button--lg" to="/docs/intro">
              回到首页
            </Link>
          </div>
          <div className="margin-top--md">
            或从这些入口继续：
            <Link to="/docs/overview"> 项目全景</Link> ·
            <Link to="/docs/architecture"> 架构分层</Link> ·
            <Link to="/docs/glossary"> 术语表</Link> ·
            <Link to="/docs/learning-path"> 学习路径</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
