import net from 'net';

const GNS3_BASE_URL = "http://127.0.0.1:3080/v2";

async function fetchGNS3(endpoint) {
    const res = await fetch(`${GNS3_BASE_URL}${endpoint}`);
    if (!res.ok) {
        throw new Error(`GNS3 HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json();
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getVpcsIp(node) {
    return new Promise((resolve, reject) => {
        let output = '';
        const socket = net.createConnection(node.console, '127.0.0.1', () => {
            socket.write('\r\n');
            setTimeout(() => {
                socket.write('show ip\r\n');
            }, 500);
        });

        socket.on('data', (data) => {
            output += data.toString();
            // VPCS show ip format roughly:
            // NAME   : VPCS[1]
            // IP/MASK: 10.10.10.10/26
            // GW     : 10.10.10.1
            const ipMatch = output.match(/IP\/MASK\s*:\s*([\d\.]+)\//);
            if (ipMatch) {
                socket.end();
                resolve(ipMatch[1]);
            }
        });

        socket.on('error', (err) => {
            reject(err);
        });

        setTimeout(() => {
            socket.destroy();
            resolve(null); // Return null if it fails or times out
        }, 3000);
    });
}

async function ping(node, targetIp) {
    return new Promise((resolve) => {
        let output = '';
        const socket = net.createConnection(node.console, '127.0.0.1', () => {
            socket.write('\r\n');
            // VPCS ping default count is 5
            setTimeout(() => socket.write(`ping ${targetIp} -c 3\r\n`), 500);
        });

        socket.on('data', (data) => {
            output += data.toString();
            // Look for successful responses
            if (output.includes('84 bytes from')) {
                socket.end();
                resolve(true);
            }
            if (output.includes('host is unreachable') || output.includes('timeout')) {
                // keep waiting in case a later packet succeeds
            }
        });

        socket.on('error', () => resolve(false));

        setTimeout(() => {
            socket.destroy();
            // Check one last time
            resolve(output.includes('84 bytes from'));
        }, 5000); // 3 pings take a few seconds
    });
}

async function runHealthCheck(projectId) {
    console.log(`[Health Check] Inicando para el proyecto: ${projectId}`);

    try {
        const nodes = await fetchGNS3(`/projects/${projectId}/nodes`);
        const vpcsNodes = nodes.filter(n => n.node_type === 'vpcs' && n.status === 'started');

        if (vpcsNodes.length < 2) {
            console.log(`[Health Check] Se necesitan al menos 2 VPCS encendidas. Encontradas: ${vpcsNodes.length}`);
            return;
        }

        console.log(`[Health Check] Encontradas ${vpcsNodes.length} VPCS encendidas. Recuperando IPs...`);
        const validVpcs = [];

        for (const node of vpcsNodes) {
            process.stdout.write(`Consultando ${node.name}... `);
            const ip = await getVpcsIp(node);
            if (ip && ip !== '0.0.0.0') {
                console.log(`IP: ${ip}`);
                validVpcs.push({ ...node, ip });
            } else {
                console.log('Sin IP asignada o inalcanzable.');
            }
        }

        if (validVpcs.length < 2) {
            console.log('[Health Check] No hay suficientes VPCS con IP asignada para realizar pruebas.');
            return;
        }

        console.log('\n[Health Check] Iniciando pruebas Ping cruzadas...');
        let successCount = 0;
        let totalTests = 0;

        for (let i = 0; i < validVpcs.length; i++) {
            for (let j = 0; j < validVpcs.length; j++) {
                if (i === j) continue;
                const src = validVpcs[i];
                const dst = validVpcs[j];

                totalTests++;
                process.stdout.write(`${src.name} (${src.ip}) -> ${dst.name} (${dst.ip}) ... `);

                const ok = await ping(src, dst.ip);
                if (ok) {
                    console.log('✅ ÉXITO');
                    successCount++;
                } else {
                    console.log('❌ FALLO');
                }
            }
        }

        console.log(`\n[Health Check Resumen] ${successCount}/${totalTests} pruebas exitosas.`);
        if (successCount === totalTests) {
            console.log('🚀 ESTADO: SALUDABLE (Conectividad End-to-End confirmada)');
        } else {
            console.log('⚠️ ESTADO: DEGRADADO (Hay problemas de conectividad)');
        }

    } catch (error) {
        console.error('[Error Health Check]', error.message);
    }
}

const args = process.argv.slice(2);
const projectId = args[0] || '3ca934e9-7d2a-4bdc-9eae-a32b1b9e9ac8'; // Default: Prueba_Agente
runHealthCheck(projectId);
