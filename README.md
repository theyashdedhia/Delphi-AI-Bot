# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### Environment Variables

The application requires several environment variables for Microsoft Entra (Azure AD) authentication and API access.
These variables should be defined in a .env.local file located in the project root directory.

Required Keys
VITE_AAD_CLIENT_ID=
VITE_AAD_TENANT_ID=
VITE_API_SCOPE=
VITE_MSAL_REDIRECT_URI=

### Local HTTPS Setup (Development Environment)

In the local environment, HTTPS is required for Microsoft Entra (Azure AD) authentication, since OAuth redirects are blocked over plain HTTP.
To enable HTTPS locally, mkcert is used to generate trusted development certificates for localhost.
These certificates are for local testing only and are not used in production.

In production (AWS-hosted), SSL termination and certificates are automatically handled by AWS services such as Application Load Balancer or CloudFront.

Reason for mkcert

Browsers reject authentication redirects (for example, Microsoft sign-in) if the application is not running under HTTPS.
mkcert allows developers to create trusted SSL certificates for localhost that simulate a secure HTTPS environment locally.
The generated .pem files are unique per machine and are excluded from version control using .gitignore.

Installation and Setup Instructions

Step 1: Install Chocolatey (if not installed)
Run the following in PowerShell (Administrator mode):

Set-ExecutionPolicy Bypass -Scope Process -Force;
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
iex ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))


After installation, close and reopen PowerShell.

Step 2: Install mkcert using Chocolatey

choco install mkcert -y


Step 3: Create and Trust the Local Certificate Authority (CA)

mkcert -install


This installs a local Certificate Authority that allows browsers to trust locally generated certificates.

Step 4: Generate Certificates for localhost

Run the following in the project root (same directory as vite.config.js):

mkcert localhost


This generates two files in the root directory:

localhost.pem
localhost-key.pem


Step 5: Run the Development Server

npm install
npm run dev


After running these commands, the application will be accessible at:
https://localhost:3000

Troubleshooting

Error: ERR_SSL_VERSION_OR_CIPHER_MISMATCH
Delete existing .pem files and recreate them using mkcert localhost.

Error: "This site can’t provide a secure connection"
Ensure both localhost.pem and localhost-key.pem exist in the root directory.

If mkcert cannot be installed
You can temporarily disable HTTPS by setting https: false in vite.config.js.
The app will then run at http://localhost:3000
, though this mode is not suitable for testing Microsoft login.

Production Deployment

For production deployment, SSL certificates are managed by AWS.
Local certificates generated via mkcert are not used in production.
The Vite configuration automatically detects missing certificates and can fall back to HTTP when required.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
