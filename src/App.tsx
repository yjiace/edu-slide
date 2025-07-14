import { useState, useEffect } from 'react';
import MDXPresenter from './components/MDXPresenter';
import Setting from './components/Setting.tsx';
import Icon from 'supercons';
import './App.css';

const defaultSettings = {
    theme: 'linear-gradient(135deg, #74A5FF, #CEFF7E)',
    fontSize: 36,
    codeTheme: 'normal'
};

function App() {
    // 从 localStorage 中读取缓存数据，如果不存在则使用默认值
    const [settings, setSettings] = useState(() => {
        const cachedSettings = localStorage.getItem('settings');
        return cachedSettings ? JSON.parse(cachedSettings) : defaultSettings;
    });
    const [mdx, setMdx] = useState('');
    const [schedule, setSchedule] = useState(100);
    const [showIframe, setShowIframe] = useState(false);

    // 在设置修改时更新 localStorage 中的缓存数据
    useEffect(() => {
        localStorage.setItem('settings', JSON.stringify(settings));
        document.body.style.background = settings.theme || '';
        document.documentElement.style.setProperty('--presentation-font-size', `${settings.fontSize}px`);
    }, [settings]);

    return (
        <>
            <Setting
                settings={settings}
                onSettingsChange={setSettings}
                onFileSelect={setMdx}
            />
            {/* Markdown组件 */}
            <MDXPresenter
                content={mdx}
                settings={settings}
                setSchedule={setSchedule}
            />
            <button className="articles-btn" title="Articles" style={{ color: 'rgba(0, 0, 0, 0.1)' }}>
                <Icon glyph="menu" />
            </button>

            <button className="control-btn prev-btn" title="Previous Slide">
                <svg width="100%" height="100%" viewBox="0 0 50 100" preserveAspectRatio="xMidYMid meet"
                     xmlns="http://www.w3.org/2000/svg" style={{display: 'block'}}>
                    <title>上一页</title>
                    <path d="M 35 20 L 15 50 L 35 80" stroke="currentColor" strokeWidth="5" fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"/>
                </svg>
            </button>

            <div className="page-indicator">
                <span id="current-page">1</span> / <span id="total-pages">1</span>
            </div>

            <button className="control-btn next-btn" title="Next Slide">
                <svg width="100%" height="100%" viewBox="0 0 50 100" preserveAspectRatio="xMidYMid meet"
                     xmlns="http://www.w3.org/2000/svg" style={{display: 'block'}}>
                    <title>下一页</title>
                    <path d="M 15 20 L 35 50 L 15 80" stroke="currentColor" strokeWidth="5" fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"/>
                </svg>
            </button>

            <div className="progress-indicator">
                <span className="progress-text">{schedule}%</span>
            </div>

            <div className="clipboard-btn" onClick={() => setShowIframe(true)}>
                <Icon size={24} glyph="clipboard" />
            </div>


            {showIframe && (
                <div className="fullscreen-modal">
                    <button className="fullscreen-close-btn" onClick={() => setShowIframe(false)}>×</button>
                    <iframe
                        src="https://b.smallyoung.cn"
                        title="白板"
                        allowFullScreen
                    />
                </div>
            )}

            <div className="loader" style={{display: 'none'}}>
                <div className="spinner"></div>
            </div>
        </>
    )
}

export default App
