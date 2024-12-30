// 获取按钮和音频元素
const musicButton = document.getElementById('music-toggle');
const music = document.getElementById('background-music');
let isPlaying = true; // 默认是播放状态
let currentAvatar = 'realhuman';
window.currentAvatar = currentAvatar;

// 页面加载后自动播放音乐
window.addEventListener('DOMContentLoaded', () => {
    music.play().catch(error => {
        console.warn("音乐自动播放被阻止，用户需要交互后播放");
        isPlaying = false;
        musicButton.title = '音乐开';  // 更新工具提示文本
    });
});

// 切换音乐的播放状态
musicButton.addEventListener('click', function() {
    if (isPlaying) {
        music.pause();  // 暂停音乐
        musicButton.style.backgroundImage = "url('asset/icon/General/music-off.png')";  // 切换图标
        musicButton.title = '音乐开';  // 更新工具提示文本
    } else {
        music.play();   // 播放音乐
        musicButton.style.backgroundImage = "url('asset/icon/General/music-on.png')";  // 切换图标
        musicButton.title = '音乐关';  // 更新工具提示文本
    }
    isPlaying = !isPlaying;  // 切换状态
});

// 通过按切换数人
export function initAvatarSwitcher() {
    // 数字人配置
    const avatarConfig = {
        'realhuman': {
            name: '真人讲解员',
            image: 'asset/image/General/avatar-logo.png'
        },
        'cartoon': {
            name: '卡通讲解员',
            image: 'asset/image/General/avatar2.jpg'
        }
    };

    const avatarToggle = document.getElementById('avatarToggle');
    const avatarPopup = document.getElementById('avatar-popup');
    const avatarList = document.getElementById('avatar-list');
    const digitalContainer = document.getElementById('digital_container');
    const modelContainer = document.getElementById('model-container');

    // 默认显示digital_containter
    digitalContainer.style.display = 'block';
    modelContainer.style.display = 'none';

    // 动态生成数字人列表项
    Object.entries(avatarConfig).forEach(([id, config]) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <img src="${config.image}">
            <span>${config.name}</span>
        `;
        listItem.setAttribute('data-avatar', id);
        
        // 设置默认选中项
        if (id === 'realhuman') {
            listItem.classList.add('selected');
        }

        // 添加点击事件
        listItem.addEventListener('click', () => {
            // 移除所有选中状态
            document.querySelectorAll('#avatar-list li').forEach(item => {
                item.classList.remove('selected');
            });
            
            // 添加新的选中状态
            listItem.classList.add('selected');
            
            // 获取选中的数字人ID
            const newAvatar = listItem.getAttribute('data-avatar');
            if (newAvatar !== currentAvatar) {
                currentAvatar = newAvatar;
                window.currentAvatar = currentAvatar; // 更新全局变量
                
                console.log('Avatar switched to:', window.currentAvatar); // 调试信息

                // 根据选中的数字人ID显示或隐藏容器
                if (newAvatar === 'realhuman') {
                    digitalContainer.style.display = 'block';
                    modelContainer.style.display = 'none';
                } else if (newAvatar === 'cartoon') {
                    digitalContainer.style.display = 'none';
                    modelContainer.style.display = 'block';
                }
            }
            
            avatarPopup.style.display = 'none';
        });

        avatarList.appendChild(listItem);
    });

    // 鼠标进入显示弹窗
    avatarToggle.addEventListener('mouseenter', () => {
        avatarPopup.style.display = 'block';
        avatarToggle.classList.add('selected');
    });

    // 鼠标移出隐藏弹窗
    avatarToggle.addEventListener('mouseleave', () => {
        setTimeout(() => {
            if (!avatarPopup.matches(':hover')) {
                avatarPopup.style.display = 'none';
                avatarToggle.classList.remove('selected');
            }
        }, 100);
    });

    // 防止弹窗内点击事件冒泡
    avatarPopup.addEventListener('click', (event) => {
        event.stopPropagation();
    });
}

initAvatarSwitcher();


