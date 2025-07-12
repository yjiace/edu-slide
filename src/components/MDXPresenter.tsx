import React, { useMemo, useEffect, useState } from 'react';
import { unified } from 'unified';
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
}

// 定义幻灯片类型
interface Slide {
    id: string;
    content: string;
    title?: string;
}

const MDXPresenter: React.FC<MDXPresenterProps> = ({ content, settings }) => {
    const { fontSize, codeTheme } = settings;
    const [currentSlide, setCurrentSlide] = useState(0);

    // 分割内容为幻灯片
    const slides = useMemo((): Slide[] => {
        if (!content.trim()) return [];

        // 首先处理水平分割线，但要避免表格中的分割线
        const sections = content.split(/\n\s*---\s*\n/);

        const allSlides: Slide[] = [];

        sections.forEach((section) => {
            // 在每个section内部，按照标题分割
            const lines = section.split('\n');
            let currentSlideContent = '';
            let slideTitle = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // 检查是否是一级或二级标题
                if (line.match(/^#{1,2}\s+/)) {
                    // 如果已经有内容，先保存当前幻灯片
                    if (currentSlideContent.trim()) {
                        allSlides.push({
                            id: `slide-${allSlides.length}`,
                            content: currentSlideContent.trim(),
                            title: slideTitle
                        });
                    }

                    // 开始新幻灯片
                    slideTitle = line.replace(/^#{1,2}\s+/, '');
                    currentSlideContent = line + '\n';
                } else {
                    currentSlideContent += line + '\n';
                }
            }

            // 添加最后一个幻灯片
            if (currentSlideContent.trim()) {
                allSlides.push({
                    id: `slide-${allSlides.length}`,
                    content: currentSlideContent.trim(),
                    title: slideTitle
                });
            }
        });

        return allSlides.length > 0 ? allSlides : [{
            id: 'slide-0',
            content: content,
            title: '默认幻灯片'
        }];
    }, [content]);

    // 处理Markdown到HTML的转换
    const processMarkdown = useMemo(() => {
        return unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkRehype, { allowDangerousHtml: true })
            .use(rehypeRaw)
            .use(rehypeHighlight, { detect: true })
            .use(rehypeStringify);
    }, []);

    // 渲染幻灯片内容
    const renderSlideContent = (slide: Slide) => {
        try {
            const result = processMarkdown.processSync(slide.content);
            return { __html: String(result) };
        } catch (error) {
            console.error('Markdown processing error:', error);
            return { __html: `<pre>${slide.content}</pre>` };
        }
    };

    // 键盘事件处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                setCurrentSlide(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slides.length]);

    // 更新页面指示器
    useEffect(() => {
        const currentPageEl = document.getElementById('current-page');
        const totalPagesEl = document.getElementById('total-pages');

        if (currentPageEl && totalPagesEl) {
            currentPageEl.textContent = String(currentSlide + 1);
            totalPagesEl.textContent = String(slides.length);
        }
    }, [currentSlide, slides.length]);

    // 导航按钮点击处理
    useEffect(() => {
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');

        const handlePrevClick = () => {
            setCurrentSlide(prev => Math.max(0, prev - 1));
        };

        const handleNextClick = () => {
            setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
        };

        prevBtn?.addEventListener('click', handlePrevClick);
        nextBtn?.addEventListener('click', handleNextClick);

        return () => {
            prevBtn?.removeEventListener('click', handlePrevClick);
            nextBtn?.removeEventListener('click', handleNextClick);
        };
    }, [slides.length]);

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

    if (!slides.length) {
        return (
            <div className="presentation-container" id="presentation">
                <div className="slide active" style={{ fontSize: `${fontSize}px` }}>
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
                    style={{ fontSize: `${fontSize}px` }}
                >
                    <div
                        className="segmented-content"
                        dangerouslySetInnerHTML={renderSlideContent(slide)}
                    />
                </div>
            ))}
        </div>
    );
};

export default MDXPresenter;