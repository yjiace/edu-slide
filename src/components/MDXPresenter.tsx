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
            {/* 可以在此插入渲染内容 */}
        </div>
    );
};

export default MDXPresenter;