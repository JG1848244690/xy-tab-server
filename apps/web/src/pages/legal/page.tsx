import { Link, useLocation } from 'react-router-dom'

const CONTACT = '1848244690@qq.com'
const ICP = '晋ICP备2026005328号'
const UPDATED = '2026-11-16'

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[760px] px-6 py-14 sm:py-20">
        <div className="mb-10 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 font-serif text-lg">
            <img src="/icon-96.png" alt="序言" className="h-7 w-7 rounded-[4px] object-cover" />
            序言
          </Link>
          <Link to="/login" className="text-[12px] text-muted-foreground hover:text-foreground">
            返回登录
          </Link>
        </div>

        <h1 className="font-serif text-[30px] leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 text-[12px] text-muted-foreground">最后更新:{UPDATED}</p>

        <div className="mt-8 text-[14px] leading-7 text-foreground/85 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:my-1.5 [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>

        <footer className="mt-14 border-t border-border pt-5 text-[11.5px] leading-6 text-muted-foreground">
          <p>序言 · 个人学习与技术交流用途,内容仅供学习参考</p>
          <p className="mt-1">
            联系:{CONTACT} ·{' '}
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="nofollow noopener"
              className="hover:text-foreground"
            >
              {ICP}
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

function Terms() {
  return (
    <Shell title="服务条款">
      <h2>一、本站是什么</h2>
      <p>
        序言是一个免费开放的 Web 开发知识库,由个人维护并接受社区投稿。站内内容用于知识整理与技术交流,
        <strong>不提供任何收费服务,也不承诺任何形式的结果</strong>。
      </p>

      <h2>二、账号</h2>
      <ul>
        <li>注册需要邮箱和密码,用于登录、投稿与审核。请使用你能长期访问的邮箱。</li>
        <li>账号仅限本人使用,不得转让、出借或用于批量注册。</li>
        <li>你可以随时停止使用本站,并联系管理员删除账号。</li>
      </ul>

      <h2>三、内容与版权</h2>
      <ul>
        <li>站内的原创文章、题目解析由本站或投稿者撰写,版权归原作者所有。</li>
        <li>
          部分题目与解析由 AI 辅助生成、再经人工整理。
          <strong>这类内容可能存在错误或不完整,仅供学习参考。</strong>
        </li>
        <li>
          你可以自由阅读、引用和分享站内内容,但请保留出处链接;
          不得整站抓取、镜像或用于商业培训再分发。
        </li>
        <li>如果站内内容侵犯了你的权益,请联系 {CONTACT},核实后会及时删除。</li>
      </ul>

      <h2>四、投稿</h2>
      <ul>
        <li>投稿进入审核队列,由 AI 初筛 + 人工复核后决定是否发布。</li>
        <li>投稿即表示你授权本站以非独占方式展示、编辑和归档该内容。</li>
        <li>请勿提交他人作品、付费题库的复制内容,或任何违法违规信息。</li>
      </ul>

      <h2>五、禁止行为</h2>
      <ul>
        <li>未经授权的批量抓取、压力测试、漏洞扫描或任何影响站点可用性的行为。</li>
        <li>发布垃圾投稿、广告、恶意链接或攻击性内容。</li>
        <li>冒用他人身份,或试图获取他人账号权限。</li>
      </ul>
      <p>出现上述行为,我们可随时限制或终止相关账号,且无需事先通知。</p>

      <h2>六、免责声明</h2>
      <p>
        站内内容基于公开资料与个人实践整理,<strong>不构成任何技术、法律或商业建议</strong>。
        因参考本站内容而产生的任何直接或间接损失,本站不承担责任。
      </p>
      <p>
        站点可能因维护、升级、网络或第三方服务原因中断,我们不保证服务持续可用。
      </p>

      <h2>七、条款变更</h2>
      <p>条款可能随站点调整而更新,更新后会在本页标注日期,继续使用即视为接受。</p>
    </Shell>
  )
}

function Privacy() {
  return (
    <Shell title="隐私政策">
      <h2>一、我们收集什么</h2>
      <p>只收集运行所必需的信息,不做用户画像,也不出售数据。</p>
      <ul>
        <li>
          <strong>账号信息</strong>:邮箱、用户名、头像。密码以不可逆哈希形式存储,我们无法读取明文。
        </li>
        <li>
          <strong>使用记录</strong>:登录时间、提交的题目与文章、答题进度。用于展示你的学习记录。
        </li>
        <li>
          <strong>技术信息</strong>:访问 IP(用于登录风控与限流)、浏览器类型、错误堆栈。
        </li>
      </ul>

      <h2>二、我们怎么用</h2>
      <ul>
        <li>提供登录、投稿、练习记录等核心功能。</li>
        <li>防止滥用(限流、防刷、异常登录识别)。</li>
        <li>定位线上故障。错误信息会发送到 Sentry(见下)。</li>
      </ul>
      <p>我们不会把你的数据用于广告投放,也不会出售或出租给第三方。</p>

      <h2>三、第三方服务</h2>
      <ul>
        <li>
          <strong>Sentry</strong>:收集前端错误堆栈,用于定位崩溃。可能包含出错页面的 URL,
          不包含你的密码。
        </li>
        <li>
          <strong>Google Analytics 4</strong>:统计访问量、来源与页面停留。会写入 `_ga` 系列 Cookie,
          IP 已做匿名化处理,数据存在 Google 服务器上。
        </li>
        <li>
          <strong>Cloudflare</strong>:部分域名的 CDN 与安全防护,会处理请求元数据(IP、UA)。
        </li>
        <li>
          <strong>邮件服务商</strong>:用于发送注册验证与找回密码邮件,仅传递邮箱地址与邮件内容。
        </li>
      </ul>

      <h2>四、Cookie 与本地存储</h2>
      <p>
        本站不使用广告或追踪 Cookie。浏览器本地会保存少量偏好(如深浅色主题、侧栏是否固定)
        和登录凭证。Google Analytics 会写入 `_ga` Cookie 用于区分访客,可用浏览器设置或
        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="nofollow noopener">
          官方停用插件
        </a>
        关闭。清除浏览器数据即可删除这些信息。
      </p>

      <h2>五、数据保留</h2>
      <ul>
        <li>账号数据保留至你申请删除。</li>
        <li>访问与错误日志保留不超过 3 个月,用于排查故障。</li>
        <li>删除账号后,你的投稿内容可能以匿名形式保留,以维持知识库的完整性。</li>
      </ul>

      <h2>六、你的权利</h2>
      <p>
        你可以随时查看、修改账号信息,也可以联系 {CONTACT} 申请导出或删除数据。
        我们会在收到请求后 30 天内处理。
      </p>

      <h2>七、未成年人</h2>
      <p>本站面向技术学习者,不针对未成年人设计。若你是未成年人,请在监护人同意下使用。</p>

      <h2>八、联系方式</h2>
      <p>
        隐私相关问题请联系:{CONTACT}(也可在站内「设置 → 联系作者」留言)。
      </p>
    </Shell>
  )
}

export default function LegalPage() {
  const { pathname } = useLocation()
  return pathname === '/privacy' ? <Privacy /> : <Terms />
}
