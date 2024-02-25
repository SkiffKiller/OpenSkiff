import {createServer, Socket} from "node:net";
import {readFileSync, appendFile} from "node:fs";
import {createSecureContext, TLSSocket} from "node:tls";

interface SocketData {
    from: string;
    to: string[];
    data: string;
    timestamp: number;
    saidhello: boolean;
    dataToggle: boolean;
}

function initiateTLS(socket: Socket) {
    // Upgrade the connection to TLS
    const secureContext = createSecureContext({
        key: readFileSync("certs/server.key", "utf8").toString(),
        cert: readFileSync("certs/server.pem", "utf8").toString(),
    });
    const securedSocket = new TLSSocket(socket, { secureContext });
    securedSocket.on("secure", () => {
        console.log("Connection secured with TLS");
    });
    securedSocket.pipe(socket);
    socket.pipe(securedSocket);
}

createServer(async (socket) => {
    console.log(`Client connected: ${socket.remoteAddress}`);
    socket.write(`220 oskiff.com OpenSkiff SMTP Server\r\n`);
    console.log(`220 oskiff.com OpenSkiff SMTP Server`);
    let socketData: SocketData = {
        from: "",
        to: [],
        data: "",
        timestamp: Date.now(),
        saidhello: false,
        dataToggle: false,
    };
    socket.on("data", (data) => {
        console.log(`[${socket.remoteAddress}]: ${data.toString()}`);
        if (socketData.dataToggle && data.toString() !== ".") {
            appendFile(
                "mailbox/" + socketData.timestamp + ".eml",
                data.toString(),
                (err) => console.error(err)
            );

            if (data.toString().trim().endsWith("\n.")) {
                socket.write("250 OK\r\n");
                console.log("250 OK");
                socketData.dataToggle = false;
            }
            return;
        }
        if (
            !socketData.saidhello &&
            !["HELO", "EHLO"].includes(
                data.toString().trim().toUpperCase().split(" ")[0]
            )
        ) {
            socket.write("503 HELO First\r\n");
            console.log("503 HELO First");
            return;
        }
        switch (data.toString().trim().split(" ")[0]) {
            case "HELO":
                socketData.from = data.toString().trim().split(" ")[1];
                socket.write("250 OK\r\n");
                console.log("250 OK");
                socketData.saidhello = true;
                break;
            case "EHLO":
                socketData.saidhello = true;
                socket.write("250-Hello\r\n");
                console.log("250-Hello");
                socket.write("250 STARTTLS\r\n");
                console.log("250 STARTTLS");
                break;
            case "NOOP":
                socket.write("250 OK");
                break;
            case "STARTTLS":
                socket.write("220 Ready to start TLS\r\n");
                initiateTLS(socket);
                break;
            case "MAIL":
                socketData.to.push(data.toString().trim().split(":")[1]);
                socket.write("250 OK\r\n");
                console.log("250 OK");
                break;
            case "RCPT":
                socketData.to.push(data.toString().trim().split(":")[1]);
                socket.write("250 OK\r\n");
                console.log("250 OK");
                break;
            case "DATA":
                socketData.dataToggle = true;
                socket.write(
                    '354 Enter message, ending with "." on a line by itself\r\n'
                );
                console.log(
                    '354 Enter message, ending with "." on a line by itself'
                );
                break;
            case "QUIT":
                socket.write("221 Bye\r\n");
                console.log("221 Bye");
                socket.end();
                break;
            default:
                socket.write("500 Unknown command\r\n");
                console.log("500 Unknown command");
                break;
        }
    });
}).listen(25, "::", () => console.log(`Listening to requests on port 25`));
