import React from 'react';

// 定义 settings 的类型结构
interface MDXSettings {
    theme: string;
    fontSize: number;
    codeTheme: string;
}

// 定义整个组件 props 的类型
interface MDXPresenterProps {
    content: string; // 假设 content 是字符串类型
    settings: MDXSettings;
}

const MDXPresenter: React.FC<MDXPresenterProps> = ({ content, settings }) => {
    const { theme, fontSize, codeTheme } = settings;
    console.log('content:', content);
    console.log('theme:', theme);
    console.log('fontSize:', fontSize);
    console.log('codeTheme:', codeTheme);

    return (
        <div className="presentation-container" id="presentation">
            <div className="slide active" style={{ fontSize: `${fontSize}px` }}>
                <div className="segmented-content">
                    <h1 id="spring-webflux-中的-httpexchange-注解" className="visible-segment">
                        Spring WebFlux 中的 @HttpExchange 注解
                    </h1>
                </div>
            </div>
            <div className="slide" style={{ fontSize: 24 }}>
                <div className="segmented-content">
                    <h1 id="spring-webflux-中的-httpexchange-注解" className="visible-segment">
                        Spring WebFlux 中的 @HttpExchange 注解
                    </h1>
                </div>
            </div>
        </div>
    );
};

export default MDXPresenter;