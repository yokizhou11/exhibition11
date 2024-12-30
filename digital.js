'use strict';

 // 定义一个对象来存储API密钥和服务器URL
const heygen_API = {
  apiKey: 'ZDhhYmM2NmY2MmJiNDc4NGI2ZmNiN2EyNjVhYThkMTQtMTcxNTYxNDYxNw==',
  serverUrl: 'https://api.heygen.com',
};

//const statusElement = document.querySelector('#status');// 获取页面上ID为status的元素，用于显示状态信息。
const apiKey = heygen_API.apiKey;// 从heygen_API对象中提取API密钥。
const SERVER_URL = heygen_API.serverUrl;// 从heygen_API对象中提取服务器URL。


let sessionInfo = null;// 用于存储会话信息的变量。
let peerConnection = null;// 用于存储RTCPeerConnection对象的变量。

// 处理接收到的消息。
function onMessage(event) {
  const message = event.data;
  console.log('Received message:', message);
}


// 定义一个异步函数来创建新的WebRTC会话,开始会话并显示音视频按钮
async function createNewSession() {
  //updateStatus(statusElement, 'Creating new session... please wait');
  console.log('Creating new session... please wait');
  showLoadingAnimation();
  const avatar = 'Angela-inblackskirt-20220820';
  const voice = '8a44173a27984487b3fa86e56004218c';
//调用newSession函数来创建新的会话，并等待响应。
  sessionInfo = await newSession('medium', avatar, voice);
// 从响应中提取服务器的SDP和ICE服务器信息。
  const { sdp: serverSdp, ice_servers2: iceServers } = sessionInfo;

// 创建一个新的RTCPeerConnection对象。
  peerConnection = new RTCPeerConnection({ iceServers: iceServers });

 // 当接收到音视频流时，触发此事件。
   peerConnection.ontrack = (event) => {
    console.log('Received the track');
    if (event.track.kind === 'audio' || event.track.kind === 'video') {
      mediaElement.srcObject = event.streams[0];
    }
  };

  // 当接收到数据通道消息时，触发此事件。
  peerConnection.ondatachannel = (event) => {
    const dataChannel = event.channel;
    dataChannel.onmessage = onMessage;
  };

// 创建一个新的RTCSessionDescription对象，设置远程描述。
  const remoteDescription = new RTCSessionDescription(serverSdp);
  await peerConnection.setRemoteDescription(remoteDescription);
  showToast('创建会话成功，点击开始');
  //updateStatus(statusElement, 'Session creation completed');
  //updateStatus(statusElement, 'Now.You can click the start button to start the stream');
  if (!sessionInfo) {
    //updateStatus(statusElement, 'Please create a connection first');
    return;
  }

  //updateStatus(statusElement, 'Starting session... please wait');
  showToast('请等待');
  // 创建本地SDP描述并等待响应。
  const localDescription = await peerConnection.createAnswer();
  // 设置本地描述。
  await peerConnection.setLocalDescription(localDescription);

// 当有ICE候选时，触发此事件。
  peerConnection.onicecandidate = ({ candidate }) => {
    console.log('Received ICE candidate:', candidate);
    if (candidate) {
      handleICE(sessionInfo.session_id, candidate.toJSON());
    }
  };

// 当ICE连接状态变化时，触发此事件。
  peerConnection.oniceconnectionstatechange = (event) => {
    // updateStatus(
    //   statusElement,
    //   `ICE connection state changed to: ${peerConnection.iceConnectionState}`,
    // );
  };



  //调用startSession函数来开始会话。
  await startSession(sessionInfo.session_id, localDescription);
  // 获取接收器。
  var receivers = peerConnection.getReceivers();
  receivers.forEach((receiver) => { // 遍历接收器。
    receiver.jitterBufferTarget = 0
  }); // 设置抖动缓冲目标为500毫秒。
  //开始绘画后显示画布元素
  hideElement(mediaElement);
  showElement(canvasElement);
  hideLoadingAnimation();
  renderCanvas();
}

// async function startAndDisplaySession() {
//   if (!sessionInfo) {
//     //updateStatus(statusElement, 'Please create a connection first');
//     return;
//   }

//   //updateStatus(statusElement, 'Starting session... please wait');
//   showToast('请等待');
//   // 创建本地SDP描述并等待响应。
//   const localDescription = await peerConnection.createAnswer();
//   // 设置本地描述。
//   await peerConnection.setLocalDescription(localDescription);

// // 当有ICE候选时，触发此事件。
//   peerConnection.onicecandidate = ({ candidate }) => {
//     console.log('Received ICE candidate:', candidate);
//     if (candidate) {
//       handleICE(sessionInfo.session_id, candidate.toJSON());
//     }
//   };

// // 当ICE连接状态变化时，触发此事件。
//   peerConnection.oniceconnectionstatechange = (event) => {
//     updateStatus(
//       statusElement,
//       `ICE connection state changed to: ${peerConnection.iceConnectionState}`,
//     );
//   };



//   //调用startSession函数来开始会话。
//   await startSession(sessionInfo.session_id, localDescription);
//   // 获取接收器。
//   var receivers = peerConnection.getReceivers();
  
//   receivers.forEach((receiver) => { // 遍历接收器。
//     receiver.jitterBufferTarget = 500
//   }); // 设置抖动缓冲目标为500毫秒。

//   //开始绘画后显示画布元素
//   hideElement(mediaElement);
//   showElement(canvasElement);
//   renderCanvas();
//    //updateStatus(statusElement, 'Session started successfully'); // 更新状态信息。
// }

// 获取input框内文本

const taskInput = document.querySelector('#taskInput');
document.querySelector('#newBtn').addEventListener('click', createNewSession);
// document.querySelector('#startBtn').addEventListener('click', startAndDisplaySession);
document.querySelector('#closeBtn').addEventListener('click', closeConnectionHandler);
document.querySelector('#talkBtn').addEventListener('click', talkHandler);
document.addEventListener('DOMContentLoaded', function() {
  const startChatBtn = document.getElementById('newBtn');
  const closeButton = document.getElementById('closeBtn');
  const closeBtnWrap = document.getElementById('closeBtnWrap');
  const startBtnWrap = document.getElementById('startBtnWrap');
  startChatBtn.addEventListener('click', function() {
    startBtnWrap.style.display = 'none';
    closeBtnWrap.style.display = 'flex';
  });

  closeButton.addEventListener('click', function() {
    startBtnWrap.style.display = 'block';
    closeBtnWrap.style.display = 'none';
  });
});

// 重复按钮
async function repeatHandler() {
  if (!sessionInfo) {
    updateStatus(statusElement, 'Please create a connection first');

    return;
  }
  updateStatus(statusElement, 'Sending task... please wait');
  const text = taskInput.value;
  if (text.trim() === '') {
    alert('Please enter a task');
    return;
  }

  const resp = await repeat(sessionInfo.session_id, text);

  updateStatus(statusElement, 'Task sent successfully');

}

// 回答按钮

async function talkHandler() {
  if (!sessionInfo) {
    //updateStatus(statusElement, 'Please create a connection first');
    return;
  }
  const prompt = taskInput.value; // 获取输入字段的内容。
  if (prompt.trim() === '') {
    //alert('Please enter a prompt for the LLM');
    showToast('请输入文本');
    return;
  }

  //updateStatus(statusElement, 'Talking to LLM... please wait');

  
  try {
    const text = await talkToMoonshot(prompt)
    //const text = await talkToOpenAI(prompt)
    //const text = await talkToMoonshot()
    if (text) {
      // Send the AI's response to Heygen's streaming.task API
      const resp = await repeat(sessionInfo.session_id, text);
      taskInput.value = '';
      //updateStatus(statusElement, 'LLM response sent successfully');
    } else {
      //updateStatus(statusElement, 'Failed to get a response from AI');
    }
  } catch (error) {
    console.error('Error talking to AI:', error);
    //updateStatus(statusElement, 'Error talking to AI');
  }

}


// digital.js 中的新函数，用于处理从 three.js 传入的 prompt
export async function repeatbuttonHandler(prompt) {
  if (!sessionInfo) {
      // updateStatus(statusElement, 'Please create a connection first');
      return;
  }

  // updateStatus(statusElement, 'Talking to LLM... please wait');

  try {
      const text = await talkToMoonshot(prompt);
      if (text) {
          // Send the AI's response to Heygen's streaming.task API
          const resp = await repeat(sessionInfo.session_id, text);
          // 这里你可能需要更新UI来显示响应，而不是清空输入框
          // taskInput.value = '';
          // updateStatus(statusElement, 'LLM response sent successfully');
      } else {
          // updateStatus(statusElement, 'Failed to get a response from AI');
      }
  } catch (error) {
      console.error('Error talking to AI:', error);
      // updateStatus(statusElement, 'Error talking to AI');
  }
}


// 关闭对话按钮的点击事件处理函数。
async function closeConnectionHandler() {
  if (!sessionInfo) {
    //updateStatus(statusElement, 'Please create a connection first');
    return;
  }

  renderID++;
  hideElement(canvasElement);
  mediaCanPlay = false;

  //updateStatus(statusElement, 'Closing connection... please wait');
  try {
    // 关闭本地的WebRTC连接。
    peerConnection.close();
    // 调用stopSession函数，传入会话ID，以通知服务器关闭会话。
    const resp = await stopSession(sessionInfo.session_id);
    //在控制台打印关闭会话的响应结果。
    console.log(resp);
  } catch (err) {
    console.error('Failed to close the connection:', err);
  }
  //updateStatus(statusElement, 'Connection closed successfully');
}




let renderID = 0;
const mediaElement = document.querySelector('#mediaElement');
let mediaCanPlay = false;
// 绘制背景
function renderCanvas() {

  showElement(canvasElement);

  canvasElement.classList.add('show');

  const curRenderID = Math.trunc(Math.random() * 1000000000);
  renderID = curRenderID;
  //获取画布的2D渲染上下文，并设置willReadFrequently属性为true，表示频繁读取画布内容。
  const ctx = canvasElement.getContext('2d', { willReadFrequently: true });

  // 处理每一帧的函数
  function processFrame() {

    // 防止渲染过快
    if (curRenderID !== renderID) return;
    canvasElement.width = mediaElement.videoWidth;// 设置画布的宽度和高度与视频的尺寸一致。
    canvasElement.height = mediaElement.videoHeight;// 设置画布的宽度和高度与视频的尺寸一致。

    // 绘制背景图片
    ctx.drawImage(mediaElement, 0, 0, canvasElement.width, canvasElement.height);
    // 绘制背景颜色
    ctx.getContextAttributes().willReadFrequently = true;
    const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];

      // You can implement your own logic here
      if (isCloseToGreen([red, green, blue])) {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    requestAnimationFrame(processFrame);
  }

  processFrame();
}
// 判断视频颜色是否接近绿色
function isCloseToGreen(color) {
  const [red, green, blue] = color;
  return green > 90 && red < 90 && blue < 90;
}
// 隐藏元素
function hideElement(element) {
  element.classList.add('hide');
  element.classList.remove('show');
}
function showElement(element) {
  element.classList.add('show');
  element.classList.remove('hide');
}

// 监听视频加载完成事件
mediaElement.onloadedmetadata = () => {
  mediaElement.play();
  renderCanvas();
  //mediaCanPlay = true;
  //mediaElement.play();
  //showElement(bgCheckboxWrap);
};

if (mediaElement.readyState === 4) {
  renderCanvas();
}

//显示toast
export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.visibility = 'visible'; // 显示toast

  setTimeout(() => {
    toast.style.visibility = 'hidden'; // 2秒后隐藏toast
  }, 2000); // 2000毫秒后执行
}


// 显示加载动画
function showLoadingAnimation() {
  document.getElementById('loadingAnimation').style.display = 'block';
}

// 隐藏加载动画
function hideLoadingAnimation() {
  document.getElementById('loadingAnimation').style.display = 'none';
}



// new session
async function newSession(quality, avatar_name, voice_id) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.new`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      quality,
      avatar_name,
      voice: {
        voice_id: voice_id,
      },
    }),
  });
  if (response.status === 500) {
    console.error('Server error');
    //updateStatus(
    //  statusElement,
    //  'Server Error. Please ask the staff if the service has been turned on',
    //);

    throw new Error('Server error');
  } else {
    const data = await response.json();
    console.log(data.data);
    return data.data;
  }
}
// start the session
async function startSession(session_id, sdp) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session_id, sdp }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please ask the staff if the service has been turned on',
    );
    throw new Error('Server error');
  } else {
    const data = await response.json();
    return data.data;
  }
}

// submit the ICE candidate
async function handleICE(session_id, candidate) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.ice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session_id, candidate }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please ask the staff if the service has been turned on',
    );
    throw new Error('Server error');
  } else {
    const data = await response.json();
    return data;
  }
}

//async function talkToOpenAI(prompt) {
  export async function talkToMoonshot(prompt) {
    try {
      console.log('Talking to Moonshot with prompt:', prompt);
      const response = await fetch(`http://localhost:3000/moonshot/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
  
      if (response.status !== 200) {
        console.error('Server error with status:', response.status);
        const errorText = await response.text(); // 获取服务器返回的错误文本
        console.error('Server error text:', errorText);
        updateStatus(statusElement, 'Server Error. Please make sure to set the Moonshot API key');
        throw new Error('Server error');
      }
  
      const contentType = response.headers.get('Content-Type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Unexpected content type:', contentType);
        updateStatus(statusElement, 'Unexpected response from server');
        throw new Error('Unexpected response from server');
      }
  
      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Error talking to Moonshot:', error);
      updateStatus(statusElement, 'Error talking to Moonshot');
      throw error;
    }
  }

// repeat the text
  async function repeat(session_id, text) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session_id, text }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please ask the staff if the service has been turned on',
    );
    throw new Error('Server error');
  } else {
    const data = await response.json();
    return data.data;
  }
}

// stop session
async function stopSession(session_id) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session_id }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(statusElement, 'Server Error. Please ask the staff for help');
    throw new Error('Server error');
  } else {
    const data = await response.json();
    return data.data;
  }
}

