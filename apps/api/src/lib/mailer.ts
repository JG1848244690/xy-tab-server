/**
 * 发信封装:开发用 log,生产用 SMTP。
 *
 * 为什么默认 log 而不是直接连 SMTP:
 *   本地开发不该依赖任何邮件账号。log 模式把验证链接写进日志,
 *   注册流程可以完整跑通(复制链接就能验证),零外部依赖。
 *
 * 生产接阿里云邮件推送 / 腾讯企业邮时只需要改 .env:
 *   MAIL_TRANSPORT=smtp
 *   SMTP_HOST=smtpdm.aliyun.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER=<发信地址>
 *   SMTP_PASS=<控制台设置的密码>
 *   MAIL_FROM=<发信地址,必须已在服务商处验证>
 */
import nodemailer, { type Transporter } from 'nodemailer'
import env from '../env.js'

export const isLogTransport = env.MAIL_TRANSPORT === 'log'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
    if (transporter) return transporter

    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
        throw new Error(
            'MAIL_TRANSPORT=smtp 但 SMTP_HOST / SMTP_USER / SMTP_PASS 没配全',
        )
    }

    transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE === 'true',
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        // 国内服务商偶发慢,给足超时;发信失败不该拖住注册请求
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    })
    return transporter
}

export interface MailOptions {
    to: string
    subject: string
    text: string
    html: string
}

export async function sendMail(mail: MailOptions): Promise<void> {
    if (isLogTransport) {
        // 开发模式:直接打到控制台,方便复制链接
        console.info(
            `\n[mail:log] to=${mail.to} subject=${mail.subject}\n${mail.text}\n`,
        )
        return
    }

    await getTransporter().sendMail({
        from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM}>`,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        // 控制台里配的「回信地址」管不到 SMTP 发信,这里必须显式带上
        replyTo: env.MAIL_REPLY_TO || undefined,
    })
}

export function buildVerifyUrl(token: string): string {
    const base = env.APP_PUBLIC_URL.replace(/\/+$/, '')
    return `${base}/verify-email?token=${encodeURIComponent(token)}`
}

/**
 * 发验证邮件。
 *
 * 注意:调用方一律 `void sendVerificationEmail(...).catch(...)`,
 * 不要 await —— 邮件服务抖动时不该让「注册」这个动作失败。
 * 用户没收到可以点「重新发送」,这是可恢复的错误。
 */
export async function sendVerificationEmail(params: {
    to: string
    name: string | null
    token: string
}): Promise<void> {
    const url = buildVerifyUrl(params.token)
    const hours = env.EMAIL_VERIFY_TTL_HOURS
    const who = params.name ? `${params.name},你好:` : '你好:'

    await sendMail({
        to: params.to,
        subject: '验证你的邮箱 · 序言',
        text: [
            who,
            '',
            '感谢注册「序言」。点下面的链接完成邮箱验证:',
            url,
            '',
            `链接 ${hours} 小时内有效。如果不是你本人操作,忽略这封邮件即可。`,
            '',
            '—— 序言',
        ].join('\n'),
        html: `<!doctype html>
<html lang="zh-CN"><body style="margin:0;padding:32px 16px;background:#f6f3ec;">
  <div style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #e6e0d4;border-radius:6px;padding:32px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',serif;color:#1f1b16;line-height:1.75;">
    <p style="margin:0 0 20px;font-size:13px;letter-spacing:.18em;color:#8a8175;">序 言 · ADMIN</p>
    <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;">验证你的邮箱</h1>
    <p style="margin:0 0 12px;">${who}</p>
    <p style="margin:0 0 24px;color:#4a443c;">感谢注册「序言」。点下面的按钮完成验证。</p>
    <p style="margin:0 0 24px;">
      <a href="${url}" style="display:inline-block;background:#a8332a;color:#fff;text-decoration:none;padding:10px 22px;border-radius:4px;font-size:14px;">完成验证</a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;color:#8a8175;">按钮点不开时,复制这个链接到浏览器:</p>
    <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#4a443c;">${url}</p>
    <p style="margin:0;padding-top:16px;border-top:1px solid #e6e0d4;font-size:12px;color:#8a8175;">
      链接 ${hours} 小时内有效。如果不是你本人操作,忽略这封邮件即可。
    </p>
  </div>
</body></html>`,
    })
}
