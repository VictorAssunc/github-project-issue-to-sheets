"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Importer = void 0;
const Core = require("@actions/core");
const rest_1 = require("@octokit/rest");
const GitHub = require("@actions/github");
const googleapis_1 = require("googleapis");
class Importer {
    async start() {
        var _a, _b, _c, _d;
        try {
            Core.startGroup("🚦 Checking Inputs and Initializing...");
            const serviceAccountCredentials = Core.getInput(Importer.INPUT_SERVICE_ACCOUNT_JSON);
            const documentId = Core.getInput(Importer.INPUT_DOCUMENT_ID);
            const sheetName = Core.getInput(Importer.INPUT_SHEET_NAME);
            if (!serviceAccountCredentials || !documentId || !sheetName) {
                throw new Error("🚨 Some Inputs missed. Please check project README.");
            }
            const octokitArgs = {};
            var logText = "Starting GitHub";
            const githubAccessToken = Core.getInput(Importer.INPUT_GITHUB_TOKEN);
            if (!githubAccessToken) {
                Core.warning("⚠️ GitHub Access Token is not provided.");
            }
            else {
                octokitArgs["auth"] = githubAccessToken;
                logText += " with provided Token";
            }
            Core.info(`${logText}...`);
            const octokit = new rest_1.Octokit(octokitArgs);
            Core.info("Done.");
            Core.endGroup();
            Core.startGroup("📑 Getting all Issues in repository...");
            var page = 1;
            var issuesData = [];
            var issuesPage;
            do {
                Core.info(`Getting data from Issues page ${page}...`);
                issuesPage = await octokit.issues.listForRepo({
                    owner: GitHub.context.repo.owner,
                    repo: GitHub.context.repo.repo,
                    state: "all",
                    page
                });
                Core.info(`There are ${issuesPage.data.length} Issues...`);
                issuesData = issuesData.concat(issuesPage.data);
                if (issuesPage.data.length) {
                    Core.info("Next page...");
                }
                page++;
            } while (issuesPage.data.length);
            Core.info("All pages processed. Searching for assignments...");
            for (const value of issuesData.filter(value => value.assignees.length)) {
                Core.info(`Getting events for Issue ${value.title} (#${value.number})...`);
                var events = await octokit.issues.listEvents({
                    owner: GitHub.context.repo.owner,
                    repo: GitHub.context.repo.repo,
                    issue_number: value.number
                });
                Core.info(`Found ${events.data.length} events...`);
                // update last assignee
                var lastAssignee = null;
                for (const event of events.data.reverse()) {
                    if (event.event == "assigned") {
                        lastAssignee = event.created_at;
                        break;
                    }
                }
                if (lastAssignee) {
                    value.assignee_date = lastAssignee;
                }
            }
            Core.endGroup();
            Core.startGroup("🔓 Authenticating via Google API Service Account...");
            const auth = new googleapis_1.google.auth.GoogleAuth({
                // Scopes can be specified either as an array or as a single, space-delimited string.
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                credentials: JSON.parse(serviceAccountCredentials)
            });
            const sheets = googleapis_1.google.sheets({
                version: "v4",
                auth: auth
            });
            Core.info("Done.");
            Core.endGroup();
            Core.startGroup(`🧼 Cleaning old Sheet (${sheetName})...`);
            await sheets.spreadsheets.values.clear({
                spreadsheetId: documentId,
                range: sheetName,
            });
            Core.info("Done.");
            Core.endGroup();
            Core.startGroup(`🔨 Form Issues data for Sheets format...`);
            var issueSheetsData = [];
            for (const value of issuesData) {
                var labels = [];
                for (const label of value.labels) {
                    labels.push(label.name);
                }
                var assignees = [];
                for (const assignee of value.assignees) {
                    assignees.push(assignee.login);
                }
                issueSheetsData.push([
                    value.number,
                    value.state + (value.state_reason ? `-${value.state_reason}` : ""),
                    value.pull_request ? "Pull Request" : "Issue",
                    value.title,
                    value.html_url,
                    Object.keys(labels).map(k => labels[k]).join(", "),
                    value.created_at,
                    value.closed_at ? value.closed_at : "",
                    Object.keys(assignees).map(k => assignees[k]).join(", "),
                    value.assignee_date,
                    (_a = value.milestone) === null || _a === void 0 ? void 0 : _a.title,
                    (_b = value.milestone) === null || _b === void 0 ? void 0 : _b.state,
                    (_c = value.milestone) === null || _c === void 0 ? void 0 : _c.due_on,
                    (_d = value.milestone) === null || _d === void 0 ? void 0 : _d.html_url,
                ]);
            }
            issueSheetsData.forEach(value => {
                Core.info(`${Importer.LOG_BULLET_ITEM} ${JSON.stringify(value)}`);
            });
            Core.endGroup();
            Core.startGroup(`📝 Adding Issues data to Sheet (${sheetName})...`);
            Core.info("Adding header...");
            await sheets.spreadsheets.values.append({
                spreadsheetId: documentId,
                range: sheetName + "!A1:1",
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    majorDimension: "ROWS",
                    range: sheetName + "!A1:1",
                    values: [
                        ["#", "Status", "Type", "Title", "URI", "Labels", "Created At", "Closed At", "Assignees", "Last Assignee Date", "Milestone", "Milestone Status", "Milestone Deadline", "Milestone URI"]
                    ]
                }
            });
            Core.info("Appending data...");
            await sheets.spreadsheets.values.append({
                spreadsheetId: documentId,
                range: sheetName + "!A1:1",
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    majorDimension: "ROWS",
                    range: sheetName + "!A1:1",
                    values: issueSheetsData
                }
            });
            Core.info("Done.");
            Core.endGroup();
            Core.info("☑️ Done!");
        }
        catch (error) {
            Core.setFailed(error);
        }
    }
}
exports.Importer = Importer;
Importer.LOG_SPACING_SIZE = 2;
Importer.LOG_BULLET_ITEM = "·️";
Importer.INPUT_SERVICE_ACCOUNT_JSON = "google-api-service-account-credentials";
Importer.INPUT_DOCUMENT_ID = "document-id";
Importer.INPUT_SHEET_NAME = "sheet-name";
Importer.INPUT_GITHUB_TOKEN = "github-access-token";
//# sourceMappingURL=Importer.js.map