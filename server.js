const express = require('express');
const OpenAI = require('openai')
const path = require('path');
const WebSocket = require('ws');
const CryptoJS = require('crypto-js');
const Base64 = require('./base64.js');  // 引入 base64.js


const app = express();
app.use(express.json());



//moonshot api key
const moonshot = new OpenAI({
  apiKey: "sk-IeF8ZGT1WdsFpj1VXN8ZRpFSZzT7cTskFVeCHnr5amCw0ltn",    
  baseURL: "https://api.moonshot.cn/v1",
});

//const systemPrompt = [{"role": "system", "content": "hello"}]
const systemPrompt = "你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。同时，你会拒绝一切涉及恐怖主义，种族歧视，黄色暴力等问题的回答。Moonshot AI 为专有名词，不可翻译成其他语言。"

//将当前目录设置为静态文件目录，以便提供静态资源。
app.use(express.static(path.join(__dirname, '.')));

// 定义一个POST请求的处理函数，当请求路径为/openai/complete时触发。翻译如下：
// 尝试从请求的主体中获取提示。
// ���OpenAI的API生成对话完成，其中包含系统设置和用户的提示信息。
// 返回OpenAI生成的回复内容。
// 如果调用OpenAI出错，记录错误并返回500状态码和错误信息。
app.post('/moonshot/complete', async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (typeof prompt !== 'string') {
      console.error('Invalid request: prompt must be a string');
      res.status(400).send('Invalid request: prompt must be a string');
      return;
    }
    console.log('Received prompt:', prompt);

    try {
      const chatCompletion = await moonshot.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt},
          { role: 'user', content: prompt }
        ],
        model: 'moonshot-v1-8k',
      });

      console.log('Chat completion response:', chatCompletion);
      res.json({ text: chatCompletion.choices[0].message.content });
    } catch (error) {
      console.error('Moonshot API error:', error);
      res.status(500).json({ 
        error: 'Moonshot API error',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});


//监听端口
app.listen(3000, function () {
  console.log('App is listening on port 3000!');
});

// 语合成配置
const APPID = "15c6afd2"; // 替换为你的讯飞 APPID
const API_SECRET = "MWUyNzgyMDNiOTM3ZjE3MjUzMGE1ZWE2"; // 替换为你的讯飞 API_SECRET
const API_KEY = "2dafffff3af9efb452239c47f22ac48e"; // 替换为的讯飞 API_KEY

// 修改语音合成为 WebSocket 方式
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('Client connected to server WebSocket');

    ws.on('message', async (message) => {
        try {
            const { text } = JSON.parse(message);
            console.log('Received text for synthesis:', text);
            
            const url = getWebsocketUrl();
            console.log('Connecting to XFYun with URL:', url);
            
            const xfyunWs = new WebSocket(url);
            let audioData = [];
            let messageReceived = false;
            
            // 添加超时处理
            const timeout = setTimeout(() => {
                if (!messageReceived) {
                    console.error('Connection timeout');
                    xfyunWs.close();
                    ws.send(JSON.stringify({ 
                        type: 'error',
                        message: 'Connection timeout'
                    }));
                }
            }, 10000); // 10秒超时

            xfyunWs.onopen = () => {
                console.log('Connected to XFYun server');
                const params = {
                    common: { 
                        app_id: APPID 
                    },
                    business: {
                        aue: "lame",        // 改为 lame，输出MP3格式
                        sfl: 1,             // 开启流式返回
                        auf: "audio/L16;rate=16000",
                        vcn: "xiaoyan",     // 发音人
                        speed: 50,          // 语速，取值范围：[0,100]，默认为50
                        volume: 50,         // 音量，取值范围：[0,100]，默认为50
                        pitch: 50,          // 音高，取值范围：[0,100]，默认为50
                        tte: "UTF8",        // 文本编码格式
                        reg: "0",           // 设置英文发音方式
                        rdn: "0"            // 设置数字发音方式
                    },
                    data: {
                        status: 2,          // 2: 完整的数据
                        text: Base64.encode(text)  // 使用 Base64 编码文本
                    }
                };
                console.log('Sending params to XFYun:', params);
                try {
                    xfyunWs.send(JSON.stringify(params));
                    console.log('Params sent successfully');
                } catch (error) {
                    console.error('Error sending params:', error);
                }
            };

            xfyunWs.on('message', (data) => {
                messageReceived = true;
                clearTimeout(timeout);
                
                console.log('Received data from XFYun:', 
                    Buffer.isBuffer(data) ? `Binary data of size ${data.length}` : data.toString()
                );
                
                if (Buffer.isBuffer(data)) {
                    audioData.push(data);
                } else {
                    try {
                        const response = JSON.parse(data.toString());
                        console.log('XFYun response:', response);
                        if (response.code !== 0) {
                            console.error('XFYun error:', response);
                            xfyunWs.close();
                            ws.send(JSON.stringify({ 
                                type: 'error',
                                message: response.message || 'Synthesis failed'
                            }));
                        }
                    } catch (error) {
                        console.error('Error parsing XFYun response:', error);
                    }
                }
            });

            xfyunWs.on('close', (code, reason) => {
                console.log('XFYun connection closed:', code, reason);
                console.log('Audio data chunks received:', audioData.length);
                
                if (audioData.length > 0) {
                    const mergedAudio = Buffer.concat(audioData);
                    console.log('Sending merged audio data, size:', mergedAudio.length);
                    try {
                        ws.send(mergedAudio);
                        console.log('Audio data sent successfully');
                    } catch (error) {
                        console.error('Error sending audio data:', error);
                        ws.send(JSON.stringify({ 
                            type: 'error',
                            message: 'Failed to send audio data'
                        }));
                    }
                } else {
                    console.error('No audio data received');
                    ws.send(JSON.stringify({ 
                        type: 'error',
                        message: 'No audio data received'
                    }));
                }
            });

            xfyunWs.on('error', (error) => {
                console.error('XFYun WebSocket error:', error);
                clearTimeout(timeout);
                ws.send(JSON.stringify({ 
                    type: 'error',
                    message: 'WebSocket connection error'
                }));
            });

        } catch (error) {
            console.error('Error processing request:', error);
            ws.send(JSON.stringify({ 
                type: 'error',
                message: 'Failed to process request'
            }));
        }
    });
});

// 修改 getWebsocketUrl 函数，添加日志
function getWebsocketUrl() {
    // 生成RFC1123格式的时间戳
    let date = new Date().toUTCString();
    let signatureOrigin = `host: tts-api.xfyun.cn\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
    let signatureSha = CryptoJS.HmacSHA256(signatureOrigin, API_SECRET);
    let signature = CryptoJS.enc.Base64.stringify(signatureSha);
    let authorizationOrigin = `api_key="${API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    let authorization = Buffer.from(authorizationOrigin).toString('base64');
    
    const url = `wss://tts-api.xfyun.cn/v2/tts?authorization=${authorization}&date=${encodeURI(date)}&host=tts-api.xfyun.cn`;
    console.log('Generated XFYun URL:', url);
    return url;
}

// 添加对 worker 脚本的特殊处理
app.get('/processor.worker.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'processor.worker.js'));
});

// 添加必要的 CORS 头
app.use((req, res, next) => {
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});
