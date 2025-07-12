import  { useState } from 'react';
import Icon from 'supercons';
import '../style/Setting.css';

const themeGradients = [
    'linear-gradient(135deg, #74A5FF, #CEFF7E)',
    'linear-gradient(135deg, #FF74A4, #7ECEFF)',
    'linear-gradient(135deg, #A474FF, #FFE97E)',
    'linear-gradient(135deg, #74FFD1, #7E84FF)',
    'linear-gradient(135deg, #FF9D74, #7EFFD4)',
    'linear-gradient(135deg, #74FFAE, #FF7E7E)',
    'linear-gradient(135deg, #FF768D, #AEFFF8)',
    'linear-gradient(135deg, #8274FF, #FFEF72)',
    'linear-gradient(135deg, #D874FF, #FFCE72)',
    'linear-gradient(135deg, #FF74B7, #72FFBD)',
    'linear-gradient(135deg, #FF7476, #8DCCFF)',
    'linear-gradient(135deg, #FFAE5E, #85FBFF)',
    'linear-gradient(135deg, #56D413, #CBACFF)',
    'linear-gradient(135deg, #226EE0, #75FF9E)'
];

// 定义 settings 的类型结构
interface Settings {
    theme: string;
    fontSize: number;
    codeTheme: string;
}

// 定义整个组件 props 的类型
interface SettingProps {
    settings: Settings;
    onSettingsChange: (settings: Settings) => void;
    onFileSelect: (themeName: string) => void;
}

// 定义 Setting 组件
export default function Setting({ settings, onSettingsChange, onFileSelect } : SettingProps) {

    const [showSettingsPanel, setShowSettingsPanel] = useState(false);

    const toggleSettingsPanel = () => {
        setShowSettingsPanel(!showSettingsPanel);
    };

    // 更新单个设置项的辅助函数
    const updateSetting = (key:string, value: any) :void => {
        onSettingsChange({
            ...settings,
            [key]: value
        });
    };

    const  {fontSize, theme}  = settings;

    const handleFileChange =  (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result && typeof e.target.result === "string") {
                    onFileSelect(e.target.result);
                }
            };
            reader.readAsText(file);
        }
    };

    const handleThemeClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        const gradient = target.getAttribute('data-gradient');
        if (gradient) {
            document.body.style.background = gradient || '';
            updateSetting("theme", gradient);
        }
    };

    return (
        <div>
            <button className="settings-btn" title="Settings" style={{ color: 'rgba(0, 0, 0, 0.1)' }} onClick={toggleSettingsPanel}>
                <Icon glyph="settings" />
            </button>

            <div className={`settings-panel ${showSettingsPanel ? 'active' : ''}`}>
                <button className="close-settings-btn" onClick={() => setShowSettingsPanel(false)}><Icon glyph="view-close" /></button>

                <div className="markdown-source">
                    <h3>Markdown 来源</h3>
                    <label htmlFor="markdown-url">从链接加载 Markdown:</label>
                    <input type="text" id="markdown-url" placeholder="粘贴 Markdown URL" />
                    <button id="load-url">加载</button>
                    <p style={{ margin: '10px 0' }}>或者</p>
                    <label htmlFor="markdown-file">从本地文件加载 Markdown:</label>
                    <input type="file" id="markdown-file" accept=".md, .markdown, .txt" onChange={handleFileChange}/>
                </div>

                <hr style={{ margin: '15px 0', borderTop: '1px solid #eee' }} />

                <h3>背景主题</h3>
                <div className="theme-options">
                    {themeGradients.map((gradient, index) => (
                        <div
                            key={index}
                            className={`theme-option ${theme === gradient ? 'active' : ''}`}
                            style={{ background: gradient }}
                            data-gradient={gradient}
                            onClick={handleThemeClick}
                        ></div>
                    ))}
                </div>

                <hr style={{ margin: '15px 0', borderTop: '1px solid #eee' }} />

                <div className="font-size-settings">
                    <h3>字体大小</h3>
                    <div className="font-size-control">
                        <div className="font-size-slider-container">
                            <input
                                type="range"
                                id="font-size-slider"
                                min="16" max="64"
                                value={fontSize}
                                className="font-size-slider"
                                onChange={(e) => updateSetting('fontSize', e.target.value)}
                                style={{
                                    background: `linear-gradient(to right, #4a89dc ${((fontSize - 16) / (64 - 16)) * 100}%, #ddd ${((fontSize - 16) / (64 - 16)) * 100}%)`
                                }}
                            />
                            <div className="font-size-value"><span id="font-size-value">{fontSize}</span>px</div>
                        </div>
                        <div className="font-size-presets">
                            <button className="font-size-preset" data-size="24" onClick={() => updateSetting('fontSize',24)}>小</button>
                            <button className="font-size-preset" data-size="42" onClick={() => updateSetting('fontSize',42)}>中</button>
                            <button className="font-size-preset" data-size="58" onClick={() => updateSetting('fontSize',58)}>大</button>
                        </div>
                    </div>
                </div>
                <hr style={{ margin: '15px 0', borderTop: '1px solid #eee' }} />

                {/* 新增: 代码块主题 */}
                {/*<div className="code-theme-settings">*/}
                {/*    <h3>代码块主题</h3>*/}
                {/*    <select value={currentCodeTheme} onChange={(e) => onThemeChange(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd'}}>*/}
                {/*        {themeNames.map(name => (*/}
                {/*            <option key={name} value={name}>{name}</option>*/}
                {/*        ))}*/}
                {/*    </select>*/}
                {/*</div>*/}
            </div>
        </div>
    );
}