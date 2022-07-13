// -----------------------------------------------------------------------------
// モジュールのインポート
const server = require("express")();
const line = require("@line/bot-sdk"); // Messaging APIのSDKをインポート
const dialogflow = require("dialogflow");

// -----------------------------------------------------------------------------
// パラメータ設定
const line_config = {
    channelAccessToken: process.env.LINE_ACCESS_TOKEN, // 環境変数からアクセストークンをセットしています
    channelSecret: process.env.LINE_CHANNEL_SECRET // 環境変数からChannel Secretをセットしています
};
const messageQueue = ["こんにちは", "ご一緒に", "ブックオフやって", "ビッグバーガーセット", "マンション探しに来た"];
const replyQueue = ["これはこれは", "ホ↑タテ", "いらっしゃいませこんにちは！いらっしゃいませこんにちは！いらっしゃいませこんにちは！", "ビッグバーガーを千個", "うちダンジョン扱ってないんです"];
const unknown = "ちょっと何言ってるか分からない";

// -----------------------------------------------------------------------------
// Webサーバー設定
server.listen(process.env.PORT || 3000);

// -----------------------------------------------------------------------------
// APIコールのためのクライアントインスタンスを作成
const bot = new line.Client(line_config);

// Dialogflowのクライアントインスタンスを作成
const session_client = new dialogflow.SessionsClient({
    project_id: process.env.GOOGLE_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    }
});

// -----------------------------------------------------------------------------
// ルーター設定
server.post('/bot/webhook', line.middleware(line_config), (req, res, next) => {
    // 先行してLINE側にステータスコード200でレスポンスする。
    res.sendStatus(200);

    // すべてのイベント処理のプロミスを格納する配列。
    let events_processed = [];

    // イベントオブジェクトを順次処理。
    req.body.events.forEach((event) => {
        // この処理の対象をイベントタイプがメッセージで、かつ、テキストタイプだった場合に限定。
        if (event.type == "message" && event.message.type == "text"){
            events_processed.push(
                session_client.detectIntent({
                    session: session_client.sessionPath(process.env.GOOGLE_PROJECT_ID, event.source.userId),
                    queryInput: {
                        text: {
                            text: event.message.text,
                            languageCode: "ja",
                        }
                    }
                }).then((responses) => {
                    let message_text = unknown;
                    // 「注文」関連のメッセージを受け取った場合
                    if (responses[0].queryResult && responses[0].queryResult.action == "handle-order"){
                        if (responses[0].queryResult.parameters.fields.menu.stringValue){
                            message_text = `${responses[0].queryResult.parameters.fields.menu.stringValue}ですね。承りました。`;
                        } else {
                            message_text = `ご注文をどうぞ`;
                        }
                    }
                    return bot.replyMessage(event.replyToken, {
                        type: "text",
                        text: message_text
                    });
                })
            );
        }
    });

    // すべてのイベント処理が終了したら何個のイベントが処理されたか出力。
    Promise.all(events_processed).then(
        (response) => {
            console.log(`${response.length} event(s) processed.`);
        }
    );
});