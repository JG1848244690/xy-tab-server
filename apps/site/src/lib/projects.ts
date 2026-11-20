export const projects = [
    {
        id: 'newtab',
        title: '序言新标签页',
        type: 'Chrome 扩展',
        href: 'https://static.kskbl.com.cn/newtab/zh.html',
        image: 'https://static.kskbl.com.cn/newtab/assets/dock.jpg',
        alt: '雪山场景中的新标签页、书签和底部 Dock',
        description: '用 Dock 或分组整理书签，把兼容的 Wallpaper Engine 场景带进浏览器。',
    },
    {
        id: 'pi-fish',
        title: 'pi-fish',
        type: '终端阅读插件',
        href: 'https://static.kskbl.com.cn/pi-fish/',
        image: 'https://static.kskbl.com.cn/pi-fish/assets/editorial.jpg',
        alt: '纸面上一尾蓝色斗鱼游过摊开的书',
        description: '在 Pi 和 OpenCode 的终端界面读本地 TXT、EPUB，翻页、全文搜索，并在同一台电脑上接着读。',
    },
] as const

type Note = {
    slug: string
    project: typeof projects[number]['id']
    title: string
    summary: string
    body: string
}

export const projectNotes: Note[] = [
    {
        slug: 'wallpaper-engine-scene',
        project: 'newtab',
        title: '从 scene.pkg 到新标签页',
        summary: '用户选中的本地文件，怎样变成浏览器里可以渲染的 Scene。',
        body: `## 第一步是读文件

序言接收用户在设置里选择的单个壁纸目录，或一个 Scene 包。读取时先确认选择里只有一个 .pkg，检查包头，然后从同目录找可选的 project.json。元数据用来传递场景配置和显示名称。一个 Steam 工坊目录可能包含多种壁纸，文件存在并不代表浏览器能渲染其中的所有效果。

大文件存进 IndexedDB，扩展设置只保存当前 Scene 的 ID、名称、适配方式与透明度。替换壁纸时先保存新文件，再切换到新 ID，然后清理旧文件。这让导入失败时还能保留当前背景，也让新标签页重新打开时不需要再次选择路径。

## 渲染器负责什么

![序言设置中的 Scene 壁纸导入入口](https://static.kskbl.com.cn/newtab/assets/scene.jpg)

新标签页读取本机的 Scene 文件，交给随扩展一起打包的 WebWallGL。它用场景包里的资源在画布上绘制。缩放时按设置选择铺满、完整显示或拉伸，透明度由扩展的壁纸层处理。标签页隐藏时暂停渲染，释放可见页面的资源预算。

## 兼容性要看场景本身

Scene、视频和 Web 壁纸是不同类型。这里说的兼容主要是本地 Scene，包括渲染器支持的材质、效果和资源。Web/HTML 壁纸及系统音频效果当前不在支持范围。导入失败时，可以先核对壁纸类型和目录里的文件，再用一个简单的 Scene 验证环境。

[查看导入手册](https://static.kskbl.com.cn/newtab/zh.html#wallpapers)`,
    },
    {
        slug: 'wallpaper-pointer-sandbox',
        project: 'newtab',
        title: '让壁纸跟着鼠标动，又不盖住书签',
        summary: '新标签页、透明交互层和 Scene 沙箱之间的职责分配。',
        body: `## 背景层和交互层

最先要保证的是书签、搜索和设置还是正常可点。渲染壁纸的画布或 iframe 铺满背景，并设为不接管指针事件。鼠标事件由新标签页监听，再将相对坐标和按键状态交给渲染器。移动事件按动画帧合并，按下、抬起和离开则单独传递，所以点击书签与壁纸跟随可以并存。

## Chrome MV3 中的 SceneScript

当前开发实现里，Chrome 和 Edge 的 MV3 构建使用声明在扩展清单里的沙箱页。父页面先验证握手消息来自它创建的 iframe，再建立 MessageChannel。传过去的消息限定为加载用户选中的文件、可见性、适配与指针数据。沙箱不拥有扩展 API。其他构建走直接渲染路径，兼容效果也不同。

## 怎么判断是否正常

先把普通图片、静态 Scene、鼠标跟随 Scene 当成三个不同的验证场景。普通图片正常而某个 Scene 无法交互，可能是脚本或效果本身没有适配。切到后台标签页再回来，应当能恢复渲染。开发版实现和商店已发布版本应分别验证，不能只凭安装后的一个版本给所有场景下结论。

[阅读 Scene 导入手册](https://static.kskbl.com.cn/newtab/zh.html#wallpapers)`,
    },
    {
        slug: 'pi-extension-workbench',
        project: 'pi-fish',
        title: '在 Pi 的扩展接口上做一个阅读器',
        summary: '一个 Pi 插件如何接入命令、快捷键、窗口组件和会话生命周期。',
        body: `## 从一行 widget 开始

Pi 扩展的入口由 package.json 的 pi.extensions 指定。pi-fish 在插件入口注册 /fish-add、/fish、/fish-find 等命令，再把阅读片段渲染成输入区附近的 widget。用户可以继续使用原来的聊天输入框，翻页由注册的 Alt 组合键处理。插件不需要注册供模型调用的工具。

## 阅读和搜索有自己的视图

![Pi 常驻行示意。灰色正文和进度位于输入框上方。](https://static.kskbl.com.cn/pi-fish/assets/pi-inline.png)

输入 /fish 后，插件通过 Pi 的自定义 UI 入口打开阅读器，接管该面板内的键盘交互。搜索和书架是另一套悬浮视图，在同一界面可以切换。/fish-find 返回的是书中的位置，界面再用当前宽度计算可见行。这样搜索命中能跳到包含关键词的行，切回常驻行也能接着读。

## 把引擎和宿主 API 分开

TXT 编码探测、EPUB 章节解析、折行、搜索和位置持久化都没有放进 UI 事件里。可以在没有 Pi 会话的环境跑引擎测试，OpenCode TUI 也复用了这些模块。对开发者来说，一个小插件可以先从命令和 widget 起步，等到需要输入、焦点和翻页时再加自定义视图。

[查看源码](https://github.com/JG1848244690/pi-agent-cli-fish-plugin)`,
    },
    {
        slug: 'pi-fish-opencode-progress',
        project: 'pi-fish',
        title: '把阅读进度带到 OpenCode，顺便把滚轮修细一点',
        summary: '两个终端怎样共享一处阅读位置，Orca 的滚轮输入又要怎样处理。',
        body: `## 同一个引擎，两套终端界面

OpenCode 实验版用 composer 上方的插槽挂载常驻阅读行。打开书、翻页和跳到搜索命中由命令或快捷键触发。Pi 有独立阅读器、书架与鼠标交互，OpenCode 目前保留常驻行和命令式搜索。两边共用文本解析、折行、搜索与状态模块，各自处理所在宿主的 UI。

## 保存和同步

进度保存在本机的 ~/.pi/agent/fish/state.json，也可以通过 PI_CODING_AGENT_DIR 换位置。写入先加锁，读取现有状态，按书合并，再用临时文件原子替换。监听对方写入时只更新显示，避免再次保存形成回环。两边同时翻同一本时，以最后一次保存为准。

## Orca 里的一格滚轮

Pi 全屏模式可以收到鼠标事件。Orca 的一些终端场景会把一格滚轮拆成连续事件，直接处理会一下滚过好几行，插件对相邻同方向事件做合并。右键被宿主用于粘贴时，可以改用中键、Shift 加左键，或者按 Alt+J / Alt+K。OpenCode 的适配层目前不提供鼠标翻页。

[对照 Pi 与 OpenCode 的操作说明](https://static.kskbl.com.cn/pi-fish/#hosts)`,
    },
]

export function notesFor(project: Note['project']) {
    return projectNotes.filter((note) => note.project === project)
}
