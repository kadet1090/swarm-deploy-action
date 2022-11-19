const core = require('@actions/core');
const yaml = require('yaml');
const axios = require('axios');

async function run() {
  const token = core.getInput('api-token');
  const server = core.getInput('api-server');
  const service = core.getInput('service');
  const vars = yaml.parse(core.getInput('vars')) 

  core.debug(`server: ${server}, service: ${service}, vars: ${JSON.stringify(vars)}`)

  const api = axios.create({
    baseURL: server,
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'swarm-deploy-action/1.0'
    }
  })

  const deploymentResponse = await api.post(
    '/deployment', {
      service,
      vars
    }
  )

  if (deploymentResponse.status !== 200) {
    throw new Error(deploymentResponse.data.detail)
  }

  const deployment = deploymentResponse.data;

  core.setOutput('deployment-id', deployment.id);

  const logsStreamResponse = await api.get(deployment._links.logs.href, { responseType: 'stream' });
  const logsStream = logsStreamResponse.data;

  await new Promise(resolve => {
    logsStream.on('data', data => core.info(data.toString().trim()))
    logsStream.on('end', () => resolve())
  })

  const resultResponse = await api.get(deployment._links.self.href)
  const result = resultResponse.data;

  if (result.status !== 'successful') {
    core.setFailed(`Deployment ${deployment.id} status: ${result.status}`);
  } 
}

try {
  run();
} catch (error) {
  core.setFailed(error.message);
}