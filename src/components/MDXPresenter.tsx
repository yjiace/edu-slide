import React, {useMemo, useEffect, useState, useCallback, useRef} from 'react';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';

// 定义 settings 的类型结构
interface MDXSettings {
    theme: string;
    fontSize: number;
    codeTheme: string;
}

// 定义整个组件 props 的类型
interface MDXPresenterProps {
    content: string;
    settings: MDXSettings;
    setSchedule: (schedule: number) => void;
}

// 定义幻灯片类型
interface Slide {
    id: string;
    content: string;
    title?: string;
    segments: ContentSegment[];
}

// 定义内容片段类型
interface ContentSegment {
    id: string;
    type: 'text' | 'code' | 'list' | 'heading' | 'image' | 'table' | 'listItem';
    content: string;
    isVisible: boolean;
    animationDelay?: number;
}

// 自定义rehype插件，为所有链接添加target="_blank"和rel="noopener noreferrer"
const rehypeExternalLinks = () => {
    return (tree: any) => {
        const visit = (node: any) => {
            if (node.type === 'element' && node.tagName === 'a') {
                node.properties = node.properties || {};
                node.properties.target = '_blank';
                node.properties.rel = 'noopener noreferrer';
            }

            if (node.children) {
                node.children.forEach(visit);
            }
        };

        visit(tree);
    };
};

const MDXPresenter: React.FC<MDXPresenterProps> = ({content, settings, setSchedule}) => {
    const {fontSize, codeTheme} = settings;
    const [currentSlide, setCurrentSlide] = useState(0);
    const [slideSegments, setSlideSegments] = useState<{ [slideId: string]: ContentSegment[] }>({});
    const lastWheelTime = useRef(0);
    const wheelDeltaAccumulator = useRef(0);
    // 新增一个 ref 来记录上一次成功触发显示的时间，用于实现冷却机制
    const lastTriggerTime = useRef(0);

    // 解析内容为片段
    const parseContentToSegments = (content: string): ContentSegment[] => {
        const lines = content.split('\n');
        const segments: ContentSegment[] = [];
        let currentCodeBlock = '';
        let inCodeBlock = false;
        let segmentId = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 检查代码块开始/结束
            if (line.trim().startsWith('```')) {
                if (inCodeBlock) {
                    // 代码块结束
                    currentCodeBlock += line + '\n';
                    segments.push({
                        id: `segment-${segmentId++}`,
                        type: 'code',
                        content: currentCodeBlock.trim(),
                        isVisible: false
                    });
                    currentCodeBlock = '';
                    inCodeBlock = false;
                } else {
                    // 代码块开始
                    inCodeBlock = true;
                    currentCodeBlock = line + '\n';
                }
                continue;
            }

            if (inCodeBlock) {
                currentCodeBlock += line + '\n';
                continue;
            }

            // 跳过空行
            if (line.trim() === '') {
                continue;
            }

            // ========================= 修改开始 =========================
            // 将表格作为一个整体处理，而不是逐行处理。
            // GFM 表格的特征：
            // 1. 至少有两行。
            // 2. 第一行是表头，包含管道符 `|`。
            // 3. 第二行是分隔符，包含管道符 `|` 和短横线 `-`。
            if (
                line.includes('|') &&                                       // 当前行是潜在的表头
                i + 1 < lines.length &&                                     // 后面还有行
                lines[i + 1].includes('|') && lines[i + 1].includes('-') && // 下一行是分隔符
                lines[i+1].trim().replace(/[-|: \t]/g, '').length === 0      // 确保分隔符行只包含有效字符
            ) {
                let tableContent = [line];
                let j = i + 1;

                // 继续读取，直到遇到空行或不再是表格行的行
                while (j < lines.length && lines[j].trim() !== '') {
                    // 表格的行（包括分隔符和数据行）通常都包含管道符
                    if (lines[j].includes('|')) {
                        tableContent.push(lines[j]);
                        j++;
                    } else {
                        break;
                    }
                }

                segments.push({
                    id: `segment-${segmentId++}`,
                    type: 'table',
                    content: tableContent.join('\n'), // 将整个表格块作为内容
                    isVisible: false
                });

                i = j - 1; // 更新外层循环的索引，跳过已处理的行
                continue;
            }

            // 确定片段类型
            let type: ContentSegment['type'] = 'text';
            if (line.match(/^#{1,6}\s+/)) {
                type = 'heading';
            } else if (line.match(/^[-*+]\s+/) || line.match(/^\d+\.\s+/)) {
                type = 'listItem'; // 每个列表项单独处理
            } else if (line.match(/^!\[.*\]\(.*\)$/)) {
                type = 'image';
            }

            // 处理列表项（每个列表项单独作为一个片段）
            if (type === 'listItem') {
                let listItemContent = line;
                let j = i + 1;

                // 检查是否有缩进的子内容
                while (j < lines.length && lines[j].match(/^\s{2,}/)) {
                    listItemContent += '\n' + lines[j];
                    j++;
                }

                segments.push({
                    id: `segment-${segmentId++}`,
                    type: 'listItem',
                    content: listItemContent,
                    isVisible: false
                });

                i = j - 1; // 跳过已处理的行
                continue;
            }

            // 普通文本、标题、图片
            segments.push({
                id: `segment-${segmentId++}`,
                type,
                content: line,
                isVisible: false
            });
        }

        // 第一个片段默认显示
        if (segments.length > 0) {
            segments[0].isVisible = true;
        }

        return segments;
    };

    // 分割内容为幻灯片
    const slides = useMemo((): Slide[] => {
        if (!content.trim()) return [];

        const sections = content.split(/\n\s*---\s*\n/);
        const allSlides: Slide[] = [];

        sections.forEach((section) => {
            const lines = section.split('\n');
            let currentSlideContent = '';
            let slideTitle = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (line.match(/^#{1,2}\s+/)) {
                    if (currentSlideContent.trim()) {
                        const segments = parseContentToSegments(currentSlideContent.trim());
                        allSlides.push({
                            id: `slide-${allSlides.length}`,
                            content: currentSlideContent.trim(),
                            title: slideTitle,
                            segments
                        });
                    }

                    slideTitle = line.replace(/^#{1,2}\s+/, '');
                    currentSlideContent = line + '\n';
                } else {
                    currentSlideContent += line + '\n';
                }
            }

            if (currentSlideContent.trim()) {
                const segments = parseContentToSegments(currentSlideContent.trim());
                allSlides.push({
                    id: `slide-${allSlides.length}`,
                    content: currentSlideContent.trim(),
                    title: slideTitle,
                    segments
                });
            }
        });

        return allSlides.length > 0 ? allSlides : [{
            id: 'slide-0',
            content: content,
            title: '默认幻灯片',
            segments: parseContentToSegments(content)
        }];
    }, [content]);

    // 处理Markdown到HTML的转换
    const processMarkdown = useMemo(() => {
        return unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkRehype, {allowDangerousHtml: true})
            .use(rehypeRaw)
            .use(rehypeHighlight, {detect: true})
            .use(rehypeExternalLinks)
            .use(rehypeStringify);
    }, []);

    // 初始化幻灯片片段状态
    useEffect(() => {
        const initialSegments: { [slideId: string]: ContentSegment[] } = {};
        slides.forEach(slide => {
            initialSegments[slide.id] = slide.segments.map(segment => ({
                ...segment,
                isVisible: segment === slide.segments[0] // 只有第一个片段可见
            }));
        });
        setSlideSegments(initialSegments);
    }, [slides]);

    // 计算当前幻灯片的进度
    const calculateProgress = useCallback((slideId: string) => {
        const segments = slideSegments[slideId] || [];
        if (segments.length === 0) return 100;

        const visibleCount = segments.filter(s => s.isVisible).length;
        const progress = Math.round((visibleCount / segments.length) * 100);
        return progress;
    }, [slideSegments]);

    // 更新进度
    useEffect(() => {
        const currentSlideId = slides[currentSlide]?.id;
        if (currentSlideId) {
            const progress = calculateProgress(currentSlideId);
            setSchedule(progress);
        }
    }, [currentSlide, slideSegments, calculateProgress, setSchedule, slides]);

    // 显示下一个片段
    const showNextSegment = useCallback(() => {
        const currentSlideId = slides[currentSlide]?.id;
        if (!currentSlideId) return;

        setSlideSegments(prev => {
            const currentSegments = prev[currentSlideId] || [];
            const nextHiddenIndex = currentSegments.findIndex(s => !s.isVisible);

            if (nextHiddenIndex === -1) return prev; // 所有片段都已显示

            const updatedSegments = [...currentSegments];
            updatedSegments[nextHiddenIndex] = {
                ...updatedSegments[nextHiddenIndex],
                isVisible: true,
                animationDelay: Date.now()
            };

            return {
                ...prev,
                [currentSlideId]: updatedSegments
            };
        });
    }, [currentSlide, slides]);

    // 滚轮事件处理
    useEffect(() => {
        // ========================= 修改开始: 优化滚轮灵敏度 =========================
        // 增加滚轮阈值以降低灵敏度，需要更大幅度的滚动才能触发
        const WHEEL_THRESHOLD = 200;
        // 增加滚轮事件的超时时间，以便更好地将慢速滚动聚合为一次操作
        const WHEEL_TIMEOUT = 1000;
        // 设置一个触发冷却时间，防止单次快速滚动（如触控板滑动）连续触发多次
        const TRIGGER_COOLDOWN = 300; // 单位：毫秒

        const handleWheel = (e: WheelEvent) => {
            const presentationContainer = document.getElementById('presentation');
            if (!presentationContainer) return;

            // 检查是否在演示区域内
            const rect = presentationContainer.getBoundingClientRect();
            const isInPresentation =
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;

            if (!isInPresentation) return;

            const currentSlideId = slides[currentSlide]?.id;
            if (!currentSlideId) return;

            const currentSegments = slideSegments[currentSlideId] || [];
            const hasHiddenSegments = currentSegments.some(s => !s.isVisible);

            // 只有当前幻灯片有未显示的内容时才处理向下的滚轮事件
            if (hasHiddenSegments && e.deltaY > 0) {
                e.preventDefault();
                e.stopPropagation();

                const currentTime = Date.now();

                // 如果距离上次成功触发的时间太近，则忽略本次滚动，实现冷却效果
                if (currentTime - lastTriggerTime.current < TRIGGER_COOLDOWN) {
                    return;
                }
                // 如果两次滚动间隔超过了 TIMEOUT，则重置滚动量累加器
                if (currentTime - lastWheelTime.current > WHEEL_TIMEOUT) {
                    wheelDeltaAccumulator.current = 0;
                }

                lastWheelTime.current = currentTime;

                // 累积滚轮滚动量
                wheelDeltaAccumulator.current += Math.abs(e.deltaY);

                // 当累积值超过阈值时，触发显示下一个片段
                if (wheelDeltaAccumulator.current >= WHEEL_THRESHOLD) {
                    showNextSegment();
                    wheelDeltaAccumulator.current = 0; // 重置累积值
                    // 记录本次成功触发的时间，用于冷却机制判断
                    lastTriggerTime.current = currentTime;
                }
            }
        };

        // 使用 { passive: false } 来确保可以调用 preventDefault()
        document.addEventListener('wheel', handleWheel, {passive: false});
        return () => {
            document.removeEventListener('wheel', handleWheel);
        };
    }, [currentSlide, slides, slideSegments, showNextSegment]);

    // 键盘事件处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                setCurrentSlide(prev => {
                    const newSlide = Math.max(0, prev - 1);
                    // 重置新幻灯片的片段状态
                    const newSlideId = slides[newSlide]?.id;
                    if (newSlideId) {
                        setSlideSegments(prevSegments => ({
                            ...prevSegments,
                            [newSlideId]: slides[newSlide].segments.map((segment, index) => ({
                                ...segment,
                                isVisible: index === 0
                            }))
                        }));
                    }
                    return newSlide;
                });
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                setCurrentSlide(prev => {
                    const newSlide = Math.min(slides.length - 1, prev + 1);
                    // 重置新幻灯片的片段状态
                    const newSlideId = slides[newSlide]?.id;
                    if (newSlideId) {
                        setSlideSegments(prevSegments => ({
                            ...prevSegments,
                            [newSlideId]: slides[newSlide].segments.map((segment, index) => ({
                                ...segment,
                                isVisible: index === 0
                            }))
                        }));
                    }
                    return newSlide;
                });
            } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                showNextSegment();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slides, showNextSegment]);

    // 渲染片段内容
    const renderSegmentContent = (segment: ContentSegment) => {
        try {
            const result = processMarkdown.processSync(segment.content);
            return {__html: String(result)};
        } catch (error) {
            console.error('Markdown processing error:', error);
            return {__html: `<pre>${segment.content}</pre>`};
        }
    };

    // 获取动画类名
    const getAnimationClass = (segment: ContentSegment) => {
        const baseClass = 'segment-item';
        const typeClass = `segment-${segment.type}`;
        const visibleClass = segment.isVisible ? 'visible' : '';

        return `${baseClass} ${typeClass} ${visibleClass}`.trim();
    };

    // 导航按钮点击处理
    const handlePrevClick = useCallback(() => {
        setCurrentSlide(prev => {
            const newSlide = Math.max(0, prev - 1);
            // 重置新幻灯片的片段状态
            const newSlideId = slides[newSlide]?.id;
            if (newSlideId) {
                setSlideSegments(prevSegments => ({
                    ...prevSegments,
                    [newSlideId]: slides[newSlide].segments.map((segment, index) => ({
                        ...segment,
                        isVisible: index === 0
                    }))
                }));
            }
            return newSlide;
        });
    }, [slides]);

    const handleNextClick = useCallback(() => {
        setCurrentSlide(prev => {
            const newSlide = Math.min(slides.length - 1, prev + 1);
            // 重置新幻灯片的片段状态
            const newSlideId = slides[newSlide]?.id;
            if (newSlideId) {
                setSlideSegments(prevSegments => ({
                    ...prevSegments,
                    [newSlideId]: slides[newSlide].segments.map((segment, index) => ({
                        ...segment,
                        isVisible: index === 0
                    }))
                }));
            }
            return newSlide;
        });
    }, [slides]);

    // 导航按钮事件绑定
    useEffect(() => {
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', handlePrevClick);
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', handleNextClick);
        }

        return () => {
            if (prevBtn) {
                prevBtn.removeEventListener('click', handlePrevClick);
            }
            if (nextBtn) {
                nextBtn.removeEventListener('click', handleNextClick);
            }
        };
    }, [handlePrevClick, handleNextClick]);

    // 更新页面指示器
    useEffect(() => {
        const currentPageEl = document.getElementById('current-page');
        const totalPagesEl = document.getElementById('total-pages');

        if (currentPageEl && totalPagesEl) {
            currentPageEl.textContent = String(currentSlide + 1);
            totalPagesEl.textContent = String(slides.length);
        }
    }, [currentSlide, slides.length]);

    // 应用代码主题
    useEffect(() => {
        const existingLink = document.getElementById('code-theme-css');
        if (existingLink) {
            existingLink.remove();
        }

        if (codeTheme && codeTheme !== 'normal') {
            const link = document.createElement('link');
            link.id = 'code-theme-css';
            link.rel = 'stylesheet';
            link.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${codeTheme}.min.css`;
            document.head.appendChild(link);
        }
    }, [codeTheme]);

    useEffect(() => {
        const currentSlideId = slides[currentSlide]?.id;
        if (!currentSlideId || !slideSegments[currentSlideId]) return;

        const segments = slideSegments[currentSlideId];
        // 寻找最后一个可见的片段
        const lastVisibleSegment = [...segments].reverse().find(s => s.isVisible);

        if (lastVisibleSegment) {
            // 通过 ID 获取该片段的 DOM 元素
            const segmentElement = document.getElementById(lastVisibleSegment.id);
            if (segmentElement) {
                // 将该元素平滑地滚动到视图中
                // 'nearest' 意味着如果元素已经在视图内，则不会滚动
                segmentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [slideSegments, currentSlide, slides]);

    // 添加样式
    useEffect(() => {
        const styleId = 'mdx-presenter-animations';
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .segment-item {
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                margin-bottom: 1em;
            }
            
            .segment-item.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .segment-heading.visible {
                animation: slideInLeft 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .segment-code.visible {
                animation: codeBlockAppear 1s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .segment-listItem.visible {
                animation: listItemAppear 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .segment-image.visible {
                animation: imageZoomIn 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .segment-table.visible {
                animation: tableSlideUp 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .segment-text.visible {
                animation: textFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            /* 滚动条样式和行为优化 */
            .slide .segmented-content {
                overflow-y: auto;
                overflow-x: hidden;
                scrollbar-width: thin;
                scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
            }
            
            .slide .segmented-content::-webkit-scrollbar {
                width: 8px;
            }
            
            .slide .segmented-content::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .slide .segmented-content::-webkit-scrollbar-thumb {
                background-color: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
                border: 2px solid transparent;
                background-clip: content-box;
            }
            
            .slide .segmented-content::-webkit-scrollbar-thumb:hover {
                background-color: rgba(0, 0, 0, 0.5);
            }
            
            /* 确保隐藏内容不影响滚动 */
            .segment-item:not(.visible) {
                height: 0;
                overflow: hidden;
                margin: 0;
                padding: 0;
            }
            
            @keyframes slideInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-50px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes codeBlockAppear {
                from {
                    opacity: 0;
                    transform: scale(0.95) translateY(10px);
                    box-shadow: 0 0 0 rgba(0, 0, 0, 0.1);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
            }
            
            @keyframes listItemAppear {
                from {
                    opacity: 0;
                    transform: translateX(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes imageZoomIn {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            @keyframes tableSlideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes textFadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);

        return () => {
            const styleEl = document.getElementById(styleId);
            if (styleEl) {
                styleEl.remove();
            }
        };
    }, []);

    if (!slides.length) {
        return (
            <div className="presentation-container" id="presentation">
                <div className="slide active" style={{fontSize: `${fontSize}px`}}>
                    <div className="segmented-content">
                        <h1 className="visible-segment">
                            请加载一个 MDX 文档
                        </h1>
                        <p className="visible-segment">
                            使用左上角的设置按钮选择一个 MDX 文件开始演示。
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="presentation-container" id="presentation">
            {slides.map((slide, index) => (
                <div
                    key={slide.id}
                    className={`slide ${index === currentSlide ? 'active' : ''}`}
                    style={{fontSize: `${fontSize}px`}}
                    data-slide-id={slide.id}
                >
                    <div className="segmented-content">
                        {(slideSegments[slide.id] || []).map((segment) => (
                            <div
                                key={segment.id}
                                id={segment.id}
                                className={getAnimationClass(segment)}
                                dangerouslySetInnerHTML={renderSegmentContent(segment)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MDXPresenter;