const http = require('http');
const WebSocket = require('ws');

const express = require('express');

const { urlencoded } = require('body-parser');
const axios = require('axios');
const phone = require('phone');

const app = express();
app.use(express.json());
app.use(express.static('static'));
app.use(urlencoded({ extended: false }));

const statusCallbackUrl = process.env.STATUS_CALLBACK_URL;
const inboundMessageUrl = process.env.INBOUND_MESSAGE_URL;

const server = http.createServer(app);
const wss = new WebSocket.Server({server});

server.listen(process.env.PORT || 8999, () => {
    console.log(`Server started at ${server.address().port}/`);
});

let cannedMessageResponse = {
    "account_sid": "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "api_version": "2010-04-01",
    "body": "REPLACEME",
    "date_created": "Thu, 30 Jul 2015 20:12:31 +0000",
    "date_sent": "Thu, 30 Jul 2015 20:12:33 +0000",
    "date_updated": "Thu, 30 Jul 2015 20:12:33 +0000",
    "direction": "outbound-api",
    "error_code": null,
    "error_message": null,
    "from": "+15158675309",
    "messaging_service_sid": "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "num_media": "0",
    "num_segments": "1",
    "price": null,
    "price_unit": null,
    "sid": "SM-TWILINO",
    "status": "sent",
    "subresource_uris": {
        "media": "/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Media.json"
    },
    "to": "+15558675310",
    "uri": "/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.json"
};

wss.on('connection', websocket => {
    websocket.on('message', message => {
        console.log(message);
    });
});

app.post('/send', (req, res) => {
    const body = req.body;
    console.log(req.body);

    const fakeSid = 'SM-TWILINO-' + Date.now();
    const accountId = 'THIS_IS_AN_ACCOUNT_ID';

    const smsStatus = 'received';

    const params = new URLSearchParams();
    params.append('SmsSid', fakeSid);
    params.append('SmsStatus', smsStatus);
    params.append('Body', req.body.body);
    params.append('MessageStatus', smsStatus);
    params.append('To', phone(req.body.to, 'USA')[0]);
    params.append('MessageSid', fakeSid);
    params.append('AccountSid', accountId);
    params.append('From', phone(req.body.from, 'USA')[0]);
    params.append('ApiVersion', '2010-04-01');

    axios.get(
        inboundMessageUrl,
        {
            params
        }
    ).then(() => {
        res.status(201).send();
    });

});

app.all('/2010-04-01/Accounts/:id/Messages.json', (req, res) => {
    const accountId = req.params.id;
    const smsStatus = 'delivered';
    const sentFromNumber = '+15158675309';
    const to = phone(req.body.To, 'USA')[0];

    const fakeSid = 'SM-TWILINO-' + Date.now();
    cannedMessageResponse.sid = fakeSid;
    cannedMessageResponse.body = req.body.Body;
    cannedMessageResponse.to = to;
    cannedMessageResponse.messaging_service_sid = req.body.MessagingServiceSid;

    res.status(201).send(cannedMessageResponse);

    wss.clients.forEach(client => {
        client.send(
            JSON.stringify(
                {
                    'eventType': 'Incoming Message',
                    'body': req.body.Body,
                    'to': to,
                    'from': sentFromNumber,
                }
            )
        )
    });

    const params = new URLSearchParams();
    params.append('SmsSid', fakeSid);
    params.append('SmsStatus', smsStatus);
    params.append('Body', req.body.Body);
    params.append('MessageStatus', 'sent');
    params.append('To', to);
    params.append('MessageSid', fakeSid);
    params.append('AccountSid', accountId);
    params.append('From', sentFromNumber);
    params.append('ApiVersion', '2010-04-01');

    setTimeout( function() {
        axios.post(
            statusCallbackUrl,
            params
        ).then(() => {
            console.log('sent');
        });
    }, 2000);

});
