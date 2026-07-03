import clsx from "clsx"
import type { ReactNode } from "react"
import Link from "@docusaurus/Link"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import Layout from "@theme/Layout"
import Heading from "@theme/Heading"

import styles from "./index.module.css"

type Feature = {
  title: string
  description: ReactNode
}

const features: Feature[] = [
  {
    title: "项目全景",
    description: (
      <>opencode 是什么、技术栈、monorepo 地图与默认分支约定，快速建立全局认知。</>
    ),
  },
  {
    title: "架构分层",
    description: (
      <>
        Schema → Core/Protocol → Server 的依赖铁律，Client 与 sdk-next 的边界，包关系图。
      </>
    ),
  },
  {
    title: "实现原理",
    description: (
      <>
        Session V2 持久化会话、admission/execution 分离、Context Epoch 与 provider turn
        链路逐层拆解。
      </>
    ),
  },
  {
    title: "术语表",
    description: (
      <>
        基于 <code>CONTEXT.md</code> 的规范化术语（System Context、Provider Turn、Session
        Drain 等），中英对照，避免口语化歧义。
      </>
    ),
  },
]

function FeatureItem({ title, description }: Feature) {
  return (
    <div className={clsx("col col--6")}>
      <div className="text--center padding-horiz--md padding-vert--lg">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  )
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <header className={clsx("hero hero--primary", styles.heroBanner)}>
        <div className="container">
          <Heading as="h1" className="hero__title">
            {siteConfig.title}
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              开始阅读 · 5 分钟概览
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {features.map((f) => (
                <FeatureItem key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  )
}
