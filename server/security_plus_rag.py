"""CompTIA Security+ (SY0-701) Knowledge Base, LabEx Parser & Vector RAG Engine.

Provides:
- Automated ingestion of cloned https://github.com/labex-labs/comptia-security-plus-training-labs
  (all 14 hands-on Linux security labs, commands, workflows, and explanations)
- Complete gap-fill against all 28 official CompTIA Security+ (SY0-701, current 2023-2026 exam)
  sub-objectives across all 5 Domains (1.0 - 5.0)
- Comprehensive Ports & Protocols Reference (40+ exam-critical ports)
- CompTIA Security+ SY0-701 Acronym Dictionary (150+ acronyms)
- Cybersecurity Frameworks & Standards Reference (NIST CSF 2.0, MITRE ATT&CK, Kill Chain, ISO 27001, etc.)
- Practice Exam Question Bank & Interactive PBQ Simulator with detailed rationales
- Explain-My-Command Security+ CLI Flag Analyzer
- Persistent SQLite + Dense Cosine-Similarity Vector RAG Knowledge Base with strict source citations
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
import time
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
SECPLUS_DIR = ROOT_DIR / "data" / "security_plus"
LABEX_REPO_DIR = SECPLUS_DIR / "comptia-security-plus-training-labs"
RAG_DB_PATH = SECPLUS_DIR / "secplus_rag.db"

EXAM_METADATA = {
    "exam_code": "SY0-701",
    "exam_title": "CompTIA Security+ (V7 - Current Active Exam)",
    "launch_date": "2023-11-07",
    "status": "CURRENT_ACTIVE_EXAM (Replaced retired SY0-601)",
    "max_questions": 90,
    "question_types": ["Multiple-Choice (Single & Multiple)", "Performance-Based Questions (PBQs)"],
    "duration_minutes": 90,
    "passing_score": "750 (on a scale of 100-900)",
    "domains": [
        {"id": "1.0", "name": "General Security Concepts", "weight_pct": 12},
        {"id": "2.0", "name": "Threats, Vulnerabilities, and Mitigations", "weight_pct": 22},
        {"id": "3.0", "name": "Security Architecture", "weight_pct": 18},
        {"id": "4.0", "name": "Security Operations", "weight_pct": 28},
        {"id": "5.0", "name": "Security Program Management and Oversight", "weight_pct": 20},
    ],
}

# Detailed enrichment for all 14 LabEx labs from https://github.com/labex-labs/comptia-security-plus-training-labs
LABEX_ENRICHED_LABS: list[dict[str, Any]] = [
    {
        "index": "01",
        "title": "Foundational Security Concepts (CIA Triad) in Linux",
        "slug": "linux-foundational-security-concepts-cia-triad-in-linux-592882",
        "domain": "1.0",
        "objectives": ["1.1", "1.2"],
        "concepts": [
            "CIA Triad (Confidentiality, Integrity, Availability)",
            "Non-repudiation and AAA (Authentication, Authorization, Accounting)",
            "POSIX file permissions (owner/group/others, rwx, octal 600/640/755)",
            "Cryptographic hashing (SHA-256, MD5 collision weakness) for integrity verification",
            "Service availability monitoring and redundancy simulation",
        ],
        "commands": [
            "chmod 600 confidential_report.txt",
            "chown secadmin:secgroup confidential_report.txt",
            "ls -la confidential_report.txt",
            "sha256sum confidential_report.txt > confidential_report.txt.sha256",
            "sha256sum -c confidential_report.txt.sha256",
            "openssl enc -aes-256-cbc -pbkdf2 -in confidential_report.txt -out confidential_report.enc",
        ],
        "explanation": (
            "Demonstrates the CIA Triad directly on Linux: Confidentiality is enforced via strict least-privilege "
            "file permissions (`chmod 600`) and AES-256-CBC symmetric encryption (`openssl enc`); Integrity is "
            "verified using SHA-256 cryptographic checksums (`sha256sum -c`); and Availability is maintained by "
            "verifying service state and backup redundancy."
        ),
    },
    {
        "index": "02",
        "title": "Identifying Malware Indicators on Linux",
        "slug": "linux-identifying-malware-indicators-on-linux-592887",
        "domain": "2.0",
        "objectives": ["2.2", "2.4", "4.4"],
        "concepts": [
            "Indicators of Compromise (IoCs): unusual processes, rogue cron jobs, hidden files, unauthorized listeners",
            "Malware classifications: Trojan, Rootkit, Ransomware, Cryptominer, Backdoor, Worm, Keylogger, Logic Bomb",
            "Process & network socket inspection on compromised endpoints",
            "File signature & rootkit scanning",
        ],
        "commands": [
            "ps aux --sort=-%cpu | head -n 15",
            "ss -tulnp",
            "lsof -i -P -n",
            "crontab -l && ls -la /etc/cron* /var/spool/cron/crontabs",
            "find /tmp /var/tmp /dev/shm -type f -executable",
            "rkhunter --check --sk",
            "clamscan -r /home",
        ],
        "explanation": (
            "Teaches responders how to hunt for Linux malware indicators: identifying high-CPU cryptominers via "
            "`ps aux`, spotting unauthorized reverse shells or C2 listeners with `ss -tulnp` and `lsof -i`, "
            "checking persistence in `/etc/crontab` and `/dev/shm`, and running `rkhunter`/`clamscan`."
        ),
    },
    {
        "index": "03",
        "title": "Password Policies and Detecting Attack in Linux",
        "slug": "password-policies-and-detecting-attack-in-linux-592888",
        "domain": "2.0",
        "objectives": ["2.4", "4.6", "4.8"],
        "concepts": [
            "Password attacks: Brute-force, Dictionary, Password Spraying, Credential Stuffing, Rainbow Tables",
            "Linux PAM (`pam_pwquality`, `pam_faillock`) password complexity and account lockout policies",
            "Shadow file hashing (`/etc/shadow` with `$6$` SHA-512 or `$y$` yescrypt salted hashes)",
            "Detecting SSH brute-force attacks in `/var/log/auth.log` and blocking with `fail2ban`",
        ],
        "commands": [
            "grep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr",
            "chage -M 90 -m 7 -W 14 secuser",
            "chage -l secuser",
            "faillock --user secuser",
            "fail2ban-client status sshd",
        ],
        "explanation": (
            "Covers hardening authentication against brute-force and password spraying by configuring minimum password "
            "length/complexity in `/etc/security/pwquality.conf`, aging policies via `chage`, account lockouts via "
            "`pam_faillock`, and parsing `/var/log/auth.log` for repeated `Failed password` events."
        ),
    },
    {
        "index": "04",
        "title": "Basic Vulnerability Scanning with Nmap",
        "slug": "linux-basic-vulnerability-scanning-with-nmap-594554",
        "domain": "2.0",
        "objectives": ["2.3", "4.3"],
        "concepts": [
            "Active reconnaissance, port scanning states (open, closed, filtered), and banner grabbing",
            "TCP SYN stealth scan (`-sS`), TCP Connect scan (`-sT`), UDP scan (`-sU`), Service/Version detection (`-sV`)",
            "Nmap Scripting Engine (NSE) vulnerability scanning (`--script vuln`)",
            "Distinguishing True Positives, False Positives, True Negatives, and False Negatives",
        ],
        "commands": [
            "nmap -sn 192.168.1.0/24",
            "nmap -sS -sV -O -p 1-1024 127.0.0.1",
            "nmap --script vuln 127.0.0.1",
            "nmap -sU --top-ports 20 127.0.0.1",
        ],
        "explanation": (
            "Uses Nmap to discover live hosts, enumerate open TCP/UDP ports, fingerprint service versions (`-sV`), "
            "and execute NSE vulnerability detection scripts (`--script vuln`) to identify unpatched services and "
            "exposed attack surfaces before attackers exploit them."
        ),
    },
    {
        "index": "05",
        "title": "Demonstrating Input Validation and Code Integrity",
        "slug": "linux-demonstrating-input-validation-and-code-integrity-594556",
        "domain": "2.0",
        "objectives": ["2.3", "2.5", "3.3"],
        "concepts": [
            "Injection attacks: SQL Injection (SQLi), Command Injection, Cross-Site Scripting (XSS), Directory Traversal (`../`)",
            "Buffer overflow and memory corruption mitigations (ASLR, DEP/NX, stack canaries)",
            "Input sanitization, allowlisting, parameterized queries / prepared statements",
            "Code signing and GPG/SHA-256 verification to prevent supply-chain tampering",
        ],
        "commands": [
            "gpg --full-generate-key",
            "gpg --detach-sign --armor release_script.py",
            "gpg --verify release_script.py.asc release_script.py",
            "bandit -r ./app_source/",
        ],
        "explanation": (
            "Shows how unvalidated user input leads to OS command injection and SQL injection, how to remediate using "
            "strict input allowlisting and parameterized queries, and how to guarantee code integrity using detached "
            "GPG digital signatures (`gpg --detach-sign` and `gpg --verify`)."
        ),
    },
    {
        "index": "06",
        "title": "Ensuring Data Integrity and Authenticity with Cryptography",
        "slug": "ensuring-data-integrity-and-authenticity-with-cryptography-594576",
        "domain": "1.0",
        "objectives": ["1.2", "1.4"],
        "concepts": [
            "Symmetric encryption (AES-256, ChaCha20) vs Asymmetric encryption (RSA-2048/4096, ECC/ECDSA)",
            "Digital Signatures (signing with Private Key, verifying with Public Key) for Integrity + Non-Repudiation",
            "HMAC (Hash-based Message Authentication Code) and Salting/Key Stretching (PBKDF2, bcrypt, Argon2)",
            "Public Key Infrastructure (PKI), X.509 Certificates, CSRs, Root/Intermediate CAs",
        ],
        "commands": [
            "openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048",
            "openssl rsa -pubout -in private_key.pem -out public_key.pem",
            "openssl dgst -sha256 -sign private_key.pem -out document.sig document.txt",
            "openssl dgst -sha256 -verify public_key.pem -signature document.sig document.txt",
            "openssl req -new -x509 -key private_key.pem -out cert.pem -days 365 -subj '/CN=jarvis.local'",
        ],
        "explanation": (
            "Walks through generating RSA keypairs, signing files with a private key (`openssl dgst -sha256 -sign`), "
            "verifying authenticity and non-repudiation with the public key (`-verify`), and generating X.509 certificates."
        ),
    },
    {
        "index": "07",
        "title": "Managing User Identities and Access Controls in Linux",
        "slug": "linux-managing-user-identities-and-access-controls-in-linux-594585",
        "domain": "4.0",
        "objectives": ["4.6"],
        "concepts": [
            "Access Control Models: RBAC (Role-Based), ABAC (Attribute-Based), DAC (Discretionary), MAC (Mandatory - SELinux/AppArmor), Rule-Based",
            "Principle of Least Privilege, Separation of Duties, Just-in-Time (JIT) access, Privileged Access Management (PAM)",
            "Linux user/group lifecycle (`useradd`, `usermod`, `userdel`, `/etc/sudoers`) and Extended POSIX ACLs (`setfacl`, `getfacl`)",
        ],
        "commands": [
            "useradd -m -s /bin/bash -G developers alice",
            "usermod -L compromised_user",
            "setfacl -m u:alice:r-x /srv/project_data",
            "getfacl /srv/project_data",
            "sudo -l -U alice",
        ],
        "explanation": (
            "Implements RBAC and DAC on Linux using groups, granular `sudoers` privileges, account locking (`usermod -L`), "
            "and fine-grained POSIX Access Control Lists (`setfacl`/`getfacl`) to enforce Least Privilege."
        ),
    },
    {
        "index": "08",
        "title": "Implementing Data Resilience Backups and File Integrity",
        "slug": "linux-implementing-data-resilience-backups-and-file-integrity-594583",
        "domain": "3.0",
        "objectives": ["3.4", "4.1"],
        "concepts": [
            "Backup types: Full, Incremental (fastest backup, slowest restore), Differential (middle ground), Snapshot",
            "3-2-1 Backup Rule (3 copies, 2 media types, 1 offsite/air-gapped/immutable)",
            "RTO (Recovery Time Objective) vs RPO (Recovery Point Objective) vs MTTR vs MTBF",
            "File Integrity Monitoring (FIM) with AIDE/Tripwire and `sha256sum` baseline manifests",
        ],
        "commands": [
            "tar -czvf /backups/full_backup_$(date +%F).tar.gz /etc /var/www",
            "rsync -avz --delete /var/www/ /backups/mirror_www/",
            "find /etc -type f -exec sha256sum {} + > /var/lib/fim_baseline.sha256",
            "sha256sum -c --quiet /var/lib/fim_baseline.sha256",
        ],
        "explanation": (
            "Demonstrates creating compressed archives (`tar -czvf`), incremental synchronization (`rsync -avz`), "
            "and File Integrity Monitoring (FIM) baselines to detect unauthorized configuration drift or tampering."
        ),
    },
    {
        "index": "09",
        "title": "Introduction to Container Security with Docker",
        "slug": "linux-introduction-to-container-security-with-docker-594584",
        "domain": "3.0",
        "objectives": ["3.1", "3.3", "4.1"],
        "concepts": [
            "Containerization vs Virtualization (shared host kernel namespaces/cgroups vs hypervisor Type 1/Type 2)",
            "Container escape risks, running as non-root user (`USER 1001`), read-only root filesystems",
            "Dropping Linux kernel capabilities (`--cap-drop=ALL`) and preventing privilege escalation (`no-new-privileges`)",
            "Container image vulnerability scanning (`trivy`, `docker scout`) and signed images",
        ],
        "commands": [
            "docker run --rm -d --name secure_web --read-only --cap-drop=ALL --security-opt=no-new-privileges:true -u 1001:1001 nginx:alpine",
            "docker inspect --format='{{.HostConfig.CapDrop}} {{.HostConfig.ReadonlyRootfs}}' secure_web",
        ],
        "explanation": (
            "Hardens Docker containers by running as an unprivileged UID, enforcing a read-only root filesystem, "
            "dropping all unnecessary Linux kernel capabilities (`--cap-drop=ALL`), and blocking `setuid` privilege escalation."
        ),
    },
    {
        "index": "10",
        "title": "Hardening a Linux Endpoint with Firewall and Service Management",
        "slug": "linux-hardening-a-linux-endpoint-with-firewall-and-service-management-594582",
        "domain": "4.0",
        "objectives": ["2.5", "3.2", "4.1"],
        "concepts": [
            "Endpoint hardening: disabling unnecessary services/daemons, closing unused ports, removing default accounts",
            "Host-based firewall management (`ufw`, `iptables`, `nftables`) with Implicit Deny default policy",
            "Stateless packet filtering vs Stateful inspection firewalls",
            "Patch management and automated security updates",
        ],
        "commands": [
            "systemctl list-unit-files --type=service --state=enabled",
            "systemctl disable --now telnet.socket vsftpd",
            "ufw default deny incoming",
            "ufw default allow outgoing",
            "ufw allow 22/tcp comment 'Allow SSH'",
            "ufw enable && ufw status verbose",
        ],
        "explanation": (
            "Applies endpoint hardening by auditing and disabling insecure legacy services (`systemctl disable --now`), "
            "configuring a host-based firewall (`ufw`) with an explicit default-deny inbound posture, and verifying active rules."
        ),
    },
    {
        "index": "11",
        "title": "Network Traffic Analysis and Secure Remote Access",
        "slug": "linux-network-traffic-analysis-and-secure-remote-access-594587",
        "domain": "3.0",
        "objectives": ["3.2", "4.4", "4.5"],
        "concepts": [
            "Packet capture and analysis (`tcpdump`, Wireshark, PCAP inspection) to spot cleartext credentials vs encrypted TLS/SSH",
            "Secure remote access: SSHv2 key-based authentication (`Ed25519`/`RSA`), disabling root login and password auth",
            "VPNs (IPsec Tunnel/Transport mode, IKEv2, TLS/SSL VPN, WireGuard, Split Tunnel vs Full Tunnel) and Jump Servers / Bastion Hosts",
        ],
        "commands": [
            "tcpdump -i any -nn -c 50 'port 80 or port 22' -w /tmp/traffic.pcap",
            "tcpdump -nn -r /tmp/traffic.pcap -A",
            "ssh-keygen -t ed25519 -C 'secadmin@jarvis'",
            "sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config",
            "sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config",
            "sshd -t && systemctl reload ssh",
        ],
        "explanation": (
            "Contrasts insecure cleartext protocols (HTTP/Telnet/FTP) against encrypted channels in `tcpdump` packet captures, "
            "and hardens OpenSSH (`sshd_config`) by enforcing Ed25519 key authentication and disabling root/password logins."
        ),
    },
    {
        "index": "12",
        "title": "Monitoring and Incident Response Log Analysis",
        "slug": "linux-monitoring-and-incident-response-log-analysis-594586",
        "domain": "4.0",
        "objectives": ["4.4", "4.8"],
        "concepts": [
            "Incident Response Lifecycle (NIST SP 800-61r2: Preparation, Detection & Analysis, Containment/Eradication/Recovery, Post-Incident Activity)",
            "Centralized logging (Syslog UDP/TCP 514, TLS 6514), SIEM correlation, log aggregation (`journalctl`, `/var/log/syslog`, `/var/log/auth.log`, web access logs)",
            "Detecting SQLi, XSS, path traversal (`../etc/passwd`), and brute-force patterns in server logs",
        ],
        "commands": [
            "grep -E 'UNION SELECT|1=1|../etc/passwd|<script>' /var/log/nginx/access.log",
            "journalctl -p err..emerg -n 50 --no-pager",
            "ausearch -m USER_LOGIN -sv no",
            "iptables -A INPUT -s 203.0.113.55 -j DROP",
        ],
        "explanation": (
            "Trains analysts to hunt for web exploitation (SQLi, XSS, LFI/directory traversal) and authentication anomalies "
            "across Nginx, systemd journal, and Linux `auditd` logs, followed by immediate tactical containment (`iptables -j DROP`)."
        ),
    },
    {
        "index": "13",
        "title": "Digital Forensics Evidence Acquisition and Integrity",
        "slug": "linux-digital-forensics-evidence-acquisition-and-integrity-594581",
        "domain": "4.0",
        "objectives": ["4.8"],
        "concepts": [
            "Order of Volatility (RFC 3227): 1. CPU registers/cache -> 2. RAM/Routing/ARP tables -> 3. Temp file systems/Swap -> 4. Disk/SSD -> 5. Remote logs -> 6. Archival media",
            "Chain of Custody, Legal Hold, Write Blockers, and Bit-stream forensic imaging (`dd`, `dcfldd`, `ewfacquire`)",
            "Pre- and post-acquisition cryptographic hashing (`sha256sum`) to prove forensic integrity in court",
            "Artifact carving (`strings`, `binwalk`, `foremost`, `exiftool`, `autopsy`, `volatility` for RAM)",
        ],
        "commands": [
            "sha256sum /dev/loop0 > source_disk.sha256",
            "dd if=/dev/loop0 of=/forensics/evidence_image.raw bs=4M conv=noerror,sync status=progress",
            "sha256sum /forensics/evidence_image.raw > evidence_image.sha256",
            "chmod 444 /forensics/evidence_image.raw",
            "strings -n 8 /forensics/evidence_image.raw | grep -iE 'password|secret|http'",
        ],
        "explanation": (
            "Executes forensically sound evidence acquisition: documenting Order of Volatility, creating a bit-for-bit raw image "
            "with `dd conv=noerror,sync`, verifying identical SHA-256 hashes before and after imaging, marking evidence read-only, "
            "and extracting indicators with `strings`."
        ),
    },
    {
        "index": "14",
        "title": "Applying Security Baselines and Compliance Controls",
        "slug": "linux-applying-security-baselines-and-compliance-controls-594580",
        "domain": "5.0",
        "objectives": ["4.1", "5.1", "5.5"],
        "concepts": [
            "CIS Benchmarks, DISA STIGs, and OS configuration baselines",
            "Kernel network stack hardening via `sysctl` (`/etc/sysctl.conf`: SYN cookies, disabling IP forwarding, ignoring ICMP redirects)",
            "Automated compliance auditing with OpenSCAP and Lynis (`lynis audit system`)",
            "Mapping technical controls to regulatory compliance frameworks (PCI-DSS, HIPAA, GDPR, ISO 27001)",
        ],
        "commands": [
            "sysctl -w net.ipv4.ip_forward=0",
            "sysctl -w net.ipv4.tcp_syncookies=1",
            "sysctl -w net.ipv4.conf.all.accept_redirects=0",
            "sysctl -p",
            "lynis audit system --quick",
        ],
        "explanation": (
            "Demonstrates applying CIS Benchmark kernel hardening via `sysctl` (enabling TCP SYN cookies against SYN floods, "
            "disabling rogue packet forwarding and ICMP redirects) and running automated compliance audits with `lynis`."
        ),
    },
]

# Complete CompTIA Security+ (SY0-701) 28 Official Sub-Objectives & Gap-Fill Knowledge Base
SY0_701_OBJECTIVES_KB: list[dict[str, Any]] = [
    # DOMAIN 1.0: General Security Concepts (12%)
    {
        "objective": "1.1",
        "domain": "1.0",
        "title": "Compare and contrast various types of security controls",
        "labex_covered": True,
        "content": (
            "Security controls are divided into 4 Categories and 6 Functional Control Types:\n"
            "• Categories:\n"
            "  1. Technical (Logical): Enforced by hardware/software (Firewalls, IDS/IPS, encryption, ACLs, MFA, antivirus).\n"
            "  2. Managerial (Administrative): Policies, standards, procedures, risk assessments, background checks, vendor SLAs.\n"
            "  3. Operational: Executed day-to-day by people (Security guards, awareness training, tabletop exercises, change management).\n"
            "  4. Physical: Tangible barriers and environmental protections (Bollards, access control vestibules/mantraps, locks, CCTV, fencing, HVAC, fire suppression).\n"
            "• Functional Control Types:\n"
            "  - Preventive: Stops an incident before it happens (IPS, firewall block rule, MFA, bollard, mantrap, security培训).\n"
            "  - Deterrent: Discourages attackers (Warning signs, 'Authorized Personnel Only' login banners, visible cameras, guard dogs).\n"
            "  - Detective: Identifies and logs active or past attacks (IDS, SIEM alerts, motion detectors, audit logs, CCTV review, FIM).\n"
            "  - Corrective: Mitigates impact and restores systems after an incident (Restoring from backup, patching a vulnerability, antivirus quarantine, fire extinguisher).\n"
            "  - Compensating: Alternative control used when primary control is infeasible (Network segmentation + WAF for a legacy server that cannot be patched).\n"
            "  - Directive: Instructs users on expected behavior (Acceptable Use Policy [AUP], NDA, evacuation route signs)."
        ),
    },
    {
        "objective": "1.2",
        "domain": "1.0",
        "title": "Summarize fundamental security concepts (CIA, Non-Repudiation, AAA, Zero Trust, Deception)",
        "labex_covered": True,
        "content": (
            "• CIA Triad: Confidentiality (encryption, ACLs, masking), Integrity (hashing SHA-256, digital signatures, FIM), Availability (RAID, load balancers, UPS, backups, DDoS mitigation).\n"
            "• Non-Repudiation: Proof that an actor performed an action and cannot deny it (Digital signatures using asymmetric private key + audit logs).\n"
            "• AAA Framework: Authentication (proving identity via Something You Know/Have/Are), Authorization (permissions/RBAC), Accounting (auditing/logging actions, session duration).\n"
            "• Zero Trust Architecture (NIST SP 800-207): 'Never trust, always verify.' Eliminates implicit trust based on network location.\n"
            "  - Control Plane: Adaptive identity, threat scope reduction, policy-driven access control, Policy Engine (PE) + Policy Administrator (PA) making the Policy Decision Point (PDP).\n"
            "  - Data Plane: Implicit trust zones eliminated; Subject/System connects through Policy Enforcement Point (PEP) using microsegmentation and continuous evaluation.\n"
            "• Deception & Disruption Technology:\n"
            "  - Honeypot: Single decoy system simulating vulnerabilities to lure and study attackers.\n"
            "  - Honeynet: Network of interconnected honeypots.\n"
            "  - Honeyfile: Decoy file (e.g., `passwords_vault.xlsx`) with FIM alerts triggered immediately on open.\n"
            "  - Honeytoken: Fake credential, API key, or database record planted to detect unauthorized exfiltration."
        ),
    },
    {
        "objective": "1.3",
        "domain": "1.0",
        "title": "Explain the importance of change management processes and the impact to security",
        "labex_covered": False,
        "content": (
            "• Business Processes Impacting Security: Approval process (Change Control Board / CAB), ownership, stakeholder alignment, impact analysis, test results, backout/rollback plan, maintenance window, standard operating procedures (SOP).\n"
            "• Technical Implications: Allowlists/denylists, restricted activities, downtime, service/application restarts, legacy applications, dependencies, documentation updates (network diagrams, asset inventory), version control (`git`).\n"
            "• Exam Tip: Every production change MUST have a documented Backout Plan before approval."
        ),
    },
    {
        "objective": "1.4",
        "domain": "1.0",
        "title": "Explain the importance of using appropriate cryptographic solutions (PKI, Certificates, Modes, Quantum)",
        "labex_covered": True,
        "content": (
            "• Public Key Infrastructure (PKI): Public key encrypts / verifies signature; Private key decrypts / signs.\n"
            "• Key Escrow: Third party holds copies of private decryption keys for recovery. Key Exchange: Diffie-Hellman (DH), ECDHE (provides Perfect Forward Secrecy [PFS]).\n"
            "• Encryption Levels: Full-Disk Encryption (FDE: BitLocker, LUKS, FileVault — protects data at rest when powered off), Partition, File, Volume, Database, Record, Transport/Communication (TLS 1.3, IPsec).\n"
            "• Tools & Obfuscation: TPM (Trusted Platform Module — hardware root of trust on motherboard), HSM (Hardware Security Module — high-speed enterprise key appliance), Steganography (hiding data inside images/audio), Tokenization (replacing sensitive PAN with non-sensitive token), Data Masking (`****-****-****-1234`).\n"
            "• Hashing & Salting: SHA-256/SHA-3, HMAC, Salting (random data added before hashing to defeat Rainbow Tables), Key Stretching (PBKDF2, bcrypt, Argon2).\n"
            "• Certificates & Revocation: X.509, CSR (Certificate Signing Request), Wildcard (`*.domain.com`), SAN (Subject Alternative Name), Self-Signed vs Root/Intermediate CA, CRL (Certificate Revocation List), OCSP (Online Certificate Status Protocol), OCSP Stapling (web server caches signed OCSP response to save client latency/privacy).\n"
            "• Emerging Crypto: Post-Quantum Cryptography (lattice-based algorithms resistant to Shor's algorithm), Blockchain (immutable distributed ledger)."
        ),
    },
    # DOMAIN 2.0: Threats, Vulnerabilities, and Mitigations (22%)
    {
        "objective": "2.1",
        "domain": "2.0",
        "title": "Compare and contrast common threat actors and motivations",
        "labex_covered": False,
        "content": (
            "• Threat Actors:\n"
            "  1. Nation-State / APT (Advanced Persistent Threat): Highest sophistication/funding; motivated by geopolitical espionage, critical infrastructure disruption.\n"
            "  2. Organized Crime: High sophistication; motivated by financial gain (ransomware-as-a-service, banking Trojans, card skimming).\n"
            "  3. Hacktivist: Variable sophistication; motivated by political/social ideology (DDoS, web defacement, doxxing).\n"
            "  4. Insider Threat: Intentional (disgruntled employee sabotage/theft) or Unintentional (negligent user clicking phishing link); highest implicit access.\n"
            "  5. Unskilled Attacker (Script Kiddie): Low sophistication; uses off-the-shelf exploit kits for thrill/notoriety.\n"
            "  6. Shadow IT: Internal departments deploying unauthorized cloud/SaaS/IoT without IT security oversight.\n"
            "• Attributes: Internal vs External, Level of sophistication/capability, Resources/funding, Motivations (Financial, Disruption/chaos, Geopolitical, Philosophical, Revenge, Blackmail, War)."
        ),
    },
    {
        "objective": "2.2",
        "domain": "2.0",
        "title": "Explain common threat vectors and attack surfaces",
        "labex_covered": True,
        "content": (
            "• Message-based: Email (Phishing, Spear phishing, Whaling, BEC [Business Email Compromise]), SMS (Smishing), Instant Messaging, Voice (Vishing).\n"
            "• Image-based / File-based: Malicious macros in Office docs, weaponized PDFs, QR code phishing (Quishing).\n"
            "• Unsecured Networks: Rogue Wi-Fi, Evil Twin AP, open public Wi-Fi, Bluetooth (Bluejacking, Bluesnarfing).\n"
            "• Social Engineering Principles: Authority, Intimidation, Consensus/Social Proof, Scarcity, Familiarity, Trust, Urgency; Pretexting, Watering Hole, Typosquatting (`g00gle.com`), Tailgating vs Piggybacking.\n"
            "• Supply Chain Vectors: Hardware/software vendors, MSPs (Managed Service Providers), compromised open-source dependencies."
        ),
    },
    {
        "objective": "2.3",
        "domain": "2.0",
        "title": "Explain various types of vulnerabilities",
        "labex_covered": True,
        "content": (
            "• Application & Memory: Buffer overflow, Race conditions (TOCTOU — Time of Check to Time of Use), SQL Injection (SQLi), Cross-Site Scripting (XSS: Stored, Reflected, DOM), Cross-Site Request Forgery (CSRF), Directory Traversal (`../../`), Server-Side Request Forgery (SSRF), Insecure Deserialization.\n"
            "• Hardware/Firmware: End-of-Life (EoL) / End-of-Support (EoS), UEFI/BIOS rootkits, side-channel attacks (Spectre/Meltdown).\n"
            "• Virtualization & Cloud: VM Escape (breaking out of guest VM to host hypervisor), VM Sprawl, misconfigured public S3 buckets, overly permissive IAM roles.\n"
            "• Mobile: Jailbreaking (iOS) / Rooting (Android), Sideloading unverified APKs, Zero-day vulnerabilities (exploited before vendor patch exists).\n"
            "• Vulnerability Metrics: CVE (Common Vulnerabilities and Exposures), CVSS (Common Vulnerability Scoring System 0.0–10.0: Base, Temporal, Environmental metrics)."
        ),
    },
    {
        "objective": "2.4",
        "domain": "2.0",
        "title": "Given a scenario, analyze indicators of malicious activity",
        "labex_covered": True,
        "content": (
            "• Malware Attacks: Ransomware, Trojan, Worm (self-propagates over network without user action), Virus (requires host file/user action), Spyware, Bloatware, Rootkit (kernel/firmware stealth), Keylogger, Logic Bomb (triggers on date/event).\n"
            "• Physical Attacks: Brute-force, RFID cloning, USB cable/drop attacks (Rubber Ducky / O.MG cable), Skimming.\n"
            "• Network Attacks: DDoS (Amplification/Reflection via DNS/NTP, SYN flood, Layer 7 HTTP flood), DNS Poisoning/Spoofing, ARP Poisoning (On-path / MITM on LAN), VLAN Hopping (Switch spoofing / Double tagging), MAC Flooding.\n"
            "• Wireless Attacks: Evil Twin (rogue AP cloning legitimate SSID), Deauthentication flood, WPS PIN brute-force.\n"
            "• Cryptographic Attacks: Birthday attack (hash collisions via $2^{n/2}$), Downgrade attack (forcing TLS to legacy SSL), Replay attack, Pass-the-Hash.\n"
            "• Indicators of Compromise (IoCs): Account lockout spikes, impossible travel logins, resource consumption spikes, out-of-cycle traffic, unscheduled reboots, missing logs, published/defaced webpages."
        ),
    },
    {
        "objective": "2.5",
        "domain": "2.0",
        "title": "Explain the purpose of mitigation techniques used to secure the enterprise",
        "labex_covered": True,
        "content": (
            "• Network Segmentation: VLANs, DMZ (Screened Subnet), Air-gapping, Microsegmentation (Zero Trust).\n"
            "• Access Control & Configuration: ACLs, Least Privilege, Application Allowlisting (blocks all unapproved executables), Isolation/Sandboxing, Containers.\n"
            "• Hardening Techniques: Encryption, Host-based firewalls/HIPS, Disabling unused ports/protocols/services, Changing default credentials, Patch management, Endpoint Detection and Response (EDR).\n"
            "• IEEE 802.1X (NAC): Supplicant (client) <-> Authenticator (switch/AP) <-> Authentication Server (RADIUS)."
        ),
    },
    # DOMAIN 3.0: Security Architecture (18%)
    {
        "objective": "3.1",
        "domain": "3.0",
        "title": "Compare and contrast security implications of different architecture models",
        "labex_covered": True,
        "content": (
            "• Cloud Models (IaaS, PaaS, SaaS) & Shared Responsibility Matrix: Customer is ALWAYS responsible for Data & Account/Access management; Cloud Provider is always responsible for Physical datacenter security.\n"
            "• Infrastructure as Code (IaC): Terraform/Ansible/CloudFormation — enables version-controlled, repeatable security baselines and prevents configuration drift.\n"
            "• Serverless & Microservices: Ephemeral functions (AWS Lambda), API Gateways (rate limiting, schema validation, auth), Containers & Kubernetes.\n"
            "• Network Architectures: SD-WAN, SASE (Secure Access Service Edge = SD-WAN + Cloud Security [CASB, SWG, ZTNA, FWaaS]), On-premises vs Hybrid vs Multi-cloud.\n"
            "• Specialized Systems: ICS/SCADA (Operational Technology [OT] — prioritizes Availability and safety over Confidentiality; uses Purdue Model segmentation), RTOS (Real-Time OS), IoT, Embedded systems."
        ),
    },
    {
        "objective": "3.2",
        "domain": "3.0",
        "title": "Given a scenario, apply security principles to secure enterprise infrastructure",
        "labex_covered": True,
        "content": (
            "• Infrastructure Placement & Zones: DMZ / Screened Subnet (places public web/mail servers between external and internal firewalls), East-West traffic (server-to-server inside datacenter) vs North-South traffic (client-to-internet crossing perimeter).\n"
            "• Security Appliances: Firewalls (Web Application Firewall [WAF] protects Layer 7 HTTP against SQLi/XSS; Next-Gen Firewall [NGFW] does Deep Packet Inspection + App awareness), IDS/IPS (Signature-based vs Anomaly/Heuristic-based; In-line [IPS] vs Passive/Tap [IDS]), Load Balancers (TLS termination, active-active vs active-passive), Proxy Servers (Forward vs Reverse proxy), Jump Server / Bastion Host.\n"
            "• Secure Communication: VPN (IPsec AH/ESP, TLS, Split-tunnel vs Full-tunnel), SD-WAN, 802.1X, EAP-TLS (mutual certificates — strongest wireless auth), PEAP, WPA3-SAE (Dragonfly handshake replacing WPA2 PSK to prevent offline dictionary attacks)."
        ),
    },
    {
        "objective": "3.3",
        "domain": "3.0",
        "title": "Compare and contrast concepts and strategies to protect data",
        "labex_covered": True,
        "content": (
            "• Data Types: Regulated (PII, PHI, PCI/Cardholder), Trade secret, Intellectual property, Legal, Financial.\n"
            "• Data Classifications: Public, Private, Sensitive, Confidential, Critical, Restricted (or Govt: Unclassified, CUI, Confidential, Secret, Top Secret).\n"
            "• Data States:\n"
            "  1. Data at Rest: Stored on disk/SSD/tape -> Protected by FDE (BitLocker/LUKS), AES-256, database encryption.\n"
            "  2. Data in Transit (Motion): Crossing network -> Protected by TLS 1.3, IPsec, SSH, HTTPS.\n"
            "  3. Data in Use (Processing): In CPU/RAM -> Protected by Secure Enclaves (Intel SGX, AMD SEV), homomorphic encryption.\n"
            "• Data Sovereignty: Data is subject to the laws of the country/jurisdiction where it is physically stored.\n"
            "• Data Loss Prevention (DLP): Endpoint DLP, Network DLP, Cloud/CASB DLP (blocks unauthorized USB copy or email exfiltration of SSNs/credit cards)."
        ),
    },
    {
        "objective": "3.4",
        "domain": "3.0",
        "title": "Explain the importance of resilience and recovery in security architecture",
        "labex_covered": True,
        "content": (
            "• High Availability & Clustering: Load balancing, Active-Active vs Active-Passive failover, Multipath, NIC Teaming.\n"
            "• RAID Levels: RAID 0 (Striping only — zero redundancy, NOT resilient), RAID 1 (Mirroring — 2 disks), RAID 5 (Striping with distributed parity — survives 1 disk failure, min 3 disks), RAID 6 (Survives 2 disk failures, min 4 disks), RAID 10 (Stripe of Mirrors — fast + resilient, min 4 disks).\n"
            "• Power Protection: UPS (Uninterruptible Power Supply — short-term battery), Generator (long-term fuel backup), Dual power supplies (PDUs).\n"
            "• Recovery Sites:\n"
            "  - Hot Site: Fully mirrored live hardware + data; near-instant failover (Minutes); highest cost.\n"
            "  - Warm Site: Hardware/network connectivity present, needs current data restore (Hours/Days); moderate cost.\n"
            "  - Cold Site: Leased room/power/cooling only, no servers or data (Weeks); lowest cost.\n"
            "• Testing Types: Tabletop exercise (discussion walkthrough), Failover test, Simulation, Parallel processing (run backup system alongside primary without dropping primary)."
        ),
    },
    # DOMAIN 4.0: Security Operations (28%)
    {
        "objective": "4.1",
        "domain": "4.0",
        "title": "Given a scenario, apply common security techniques to computing resources",
        "labex_covered": True,
        "content": (
            "• Secure Baselines: Establish, deploy (GPO, MDM, Ansible), and maintain (drift detection).\n"
            "• Mobile Device Management (MDM) & Deployment Models: BYOD (Bring Your Own Device), COPE (Corporate-Owned, Personally Enabled), CYOD (Choose Your Own Device), Corporate-owned. Controls: Containerization/Work Profile, Remote wipe, Geofencing, Screen lock, Disabling sideloading.\n"
            "• Wireless Security: WPA3-SAE (Personal) & WPA3-Enterprise (192-bit suite + 802.1X RADIUS), heatmaps, site surveys."
        ),
    },
    {
        "objective": "4.2",
        "domain": "4.0",
        "title": "Explain the security implications of proper hardware, software, and data asset management",
        "labex_covered": False,
        "content": (
            "• Asset Management Lifecycle: Acquisition/Procurement -> Assignment/Accounting (CMDB, Asset tags, RFID) -> Monitoring/Tracking -> Disposal/Decommissioning.\n"
            "• Secure Data Sanitization & Destruction (NIST SP 800-88):\n"
            "  - Clear: Overwriting media with zeros/random data so it cannot be read by standard tools.\n"
            "  - Purge: Cryptographic erase (destroying FDE encryption key on SSD), Degaussing (strong magnetic field — works on magnetic HDDs/tapes, DOES NOT work on SSDs/flash/optical).\n"
            "  - Destroy: Shredding, Pulverizing, Incineration, Disintegration (mandatory for SSDs with top-secret data or damaged drives).\n"
            "  - Certification: Obtain a formal Certificate of Destruction when using third-party disposal vendors."
        ),
    },
    {
        "objective": "4.3",
        "domain": "4.0",
        "title": "Explain various activities associated with vulnerability management",
        "labex_covered": True,
        "content": (
            "• Identification Methods: Vulnerability scans (Credentialed/Authenticated vs Non-credentialed; Intrusive vs Non-intrusive), Static Application Security Testing (SAST — analyzes source code without running it), Dynamic Application Security Testing (DAST — tests running web app from outside), Software Composition Analysis (SCA — checks open-source dependencies & SBOM), Penetration Testing (Black box / Unknown environment, White box / Known environment, Gray box / Partially known), Bug Bounty, Threat Feeds (OSINT, ISACs).\n"
            "• Analysis & Remediation: Confirmation (eliminating False Positives), Prioritization (CVSS score + exploitability + asset criticality), Patching, Insurance, Segmentation, Compensating controls, Exceptions/Risk acceptance."
        ),
    },
    {
        "objective": "4.4",
        "domain": "4.0",
        "title": "Explain security alerting and monitoring concepts and tools",
        "labex_covered": True,
        "content": (
            "• Monitoring Tools: SIEM (Security Information and Event Management — log aggregation, time synchronization via NTP, correlation rules, alerting), DLP, SNMPv3 (encrypted management with authPriv), NetFlow/IPFIX (flow metadata, not full payload), Vulnerability scanners.\n"
            "• Log Sources: OS logs (Windows Event Viewer Security/System/Application, Linux `/var/log/auth.log`), Firewall/IPS logs, WAF logs, DNS/Proxy logs, Antivirus/EDR telemetry."
        ),
    },
    {
        "objective": "4.5",
        "domain": "4.0",
        "title": "Given a scenario, modify enterprise capabilities to enhance security",
        "labex_covered": True,
        "content": (
            "• Email Security Standards (Anti-Spoofing Trio):\n"
            "  1. SPF (Sender Policy Framework): DNS TXT record listing authorized outbound mail server IPs for a domain.\n"
            "  2. DKIM (DomainKeys Identified Mail): Cryptographically signs outbound email headers/body with domain's private key; public key published in DNS.\n"
            "  3. DMARC (Domain-based Message Authentication, Reporting, and Conformance): Policy (`p=none`, `p=quarantine`, `p=reject`) telling receivers what to do when SPF/DKIM fail, plus reporting.\n"
            "• DNS Security: DNSSEC (digitally signs DNS records to prevent DNS cache poisoning), DNS over HTTPS (DoH) / DNS over TLS (DoT), DNS Sinkhole (redirects requests for known malicious C2 domains to an internal analysis IP)."
        ),
    },
    {
        "objective": "4.6",
        "domain": "4.0",
        "title": "Given a scenario, implement and maintain identity and access management",
        "labex_covered": True,
        "content": (
            "• Provisioning/De-provisioning user accounts, Permission auditing, Access reviews.\n"
            "• Federation & Single Sign-On (SSO):\n"
            "  - SAML 2.0: XML-based federated authentication (Identity Provider [IdP] issues SAML assertion to Service Provider [SP]); common in enterprise web SSO.\n"
            "  - OAuth 2.0: Authorization framework (uses Access Tokens to grant delegated API access without sharing passwords).\n"
            "  - OpenID Connect (OIDC): JSON/REST identity layer built on top of OAuth 2.0 (issues JWT ID Tokens); common in mobile/modern web apps.\n"
            "  - Kerberos: Ticket-based mutual authentication protocol (KDC = AS + TGS; uses TGT and service tickets on UDP/TCP port 88) used in Active Directory.\n"
            "  - RADIUS (UDP 1812/1813 or TCP 2083; encrypts password only) vs TACACS+ (TCP 49; encrypts entire payload and separates AAA).\n"
            "• MFA Factors: Something you know (Password/PIN), Something you have (Smart card, YubiKey FIDO2/WebAuthn hardware token, Authenticator TOTP app), Something you are (Biometrics: Fingerprint, Iris, Facial — measured by FAR [False Acceptance Rate], FRR [False Rejection Rate], CER/EER [Crossover Error Rate]), Somewhere you are (Geolocation/IP)."
        ),
    },
    {
        "objective": "4.7",
        "domain": "4.0",
        "title": "Explain the importance of automation and orchestration related to secure operations",
        "labex_covered": False,
        "content": (
            "• SOAR (Security Orchestration, Automation, and Response): Executes automated Runbooks (step-by-step tactical actions) and Playbooks (broader incident workflows) to enrich indicators, isolate infected hosts via EDR, and block malicious IPs on firewalls in seconds.\n"
            "• Benefits: Enforces baselines, standardizes infrastructure via CI/CD, scales securely, Improves employee retention (reduces alert fatigue), Rapid reaction time, Eliminates human multiplier errors.\n"
            "• Risks of Automation: Single point of failure, cascading automated outages (blocking production critical IPs on false positive), technical debt, script credential exposure."
        ),
    },
    {
        "objective": "4.8",
        "domain": "4.0",
        "title": "Explain appropriate incident response activities and digital forensics",
        "labex_covered": True,
        "content": (
            "• CompTIA / NIST SP 800-61r2 Incident Response Lifecycle:\n"
            "  1. Preparation (Policies, IR plan, jump bag, training, tools)\n"
            "  2. Detection and Analysis (SIEM alerts, IoC triage, scope determination)\n"
            "  3. Containment, Eradication, and Recovery (Isolate host/VLAN -> Remove malware/patch root cause -> Restore from clean backup and monitor)\n"
            "  4. Post-Incident Activity / Lessons Learned (Root-cause analysis report, update playbooks)\n"
            "• Digital Forensics: Legal Hold, Chain of Custody (who handled evidence, when, why), Acquisition (Order of Volatility: CPU registers -> RAM -> Swap -> Disk -> Logs -> Archive), E-discovery, Non-repudiation."
        ),
    },
    {
        "objective": "4.9",
        "domain": "4.0",
        "title": "Given a scenario, use data sources to support an investigation",
        "labex_covered": True,
        "content": (
            "• Correlating data across Vulnerability scans, SIEM dashboards, Packet captures (PCAPs), NetFlow, CloudTrail/audit logs, and Threat Intelligence feeds (STIX/TAXII, AIS) to reconstruct an attack timeline."
        ),
    },
    # DOMAIN 5.0: Security Program Management and Oversight (20%)
    {
        "objective": "5.1",
        "domain": "5.0",
        "title": "Summarize elements of effective security governance",
        "labex_covered": True,
        "content": (
            "• Governance Elements: Guidelines (recommended, non-mandatory), Policies (high-level mandatory intent: AUP, InfoSec, Business Continuity, Disaster Recovery, Incident Response, SDLC, Change Management), Standards (mandatory specific technologies, e.g., AES-256), Procedures (step-by-step how-to instructions).\n"
            "• Data Roles & Responsibilities:\n"
            "  - Data Owner: Senior executive (e.g., VP/C-level) legally accountable for classifying data and defining access policy.\n"
            "  - Data Controller: Entity that determines the purposes and means of processing personal data (GDPR).\n"
            "  - Data Processor: Third party (e.g., cloud payroll vendor) that processes data on behalf of the Controller.\n"
            "  - Data Custodian / Steward: IT/Security administrator who implements day-to-day backups, encryption, and ACLs defined by the Data Owner.\n"
            "  - Data Privacy Officer (DPO): Oversees GDPR/privacy compliance strategy."
        ),
    },
    {
        "objective": "5.2",
        "domain": "5.0",
        "title": "Explain elements of the risk management process (Formulas: SLE, ALE, ARO)",
        "labex_covered": False,
        "content": (
            "• Risk Identification, Risk Assessment (Ad-hoc vs Recurring), Risk Register (tracks risk owner, likelihood, impact, mitigation status).\n"
            "• Qualitative Risk Analysis: Uses subjective scales (Low/Medium/High, 1-5 traffic-light risk matrix) based on Likelihood and Impact.\n"
            "• Quantitative Risk Analysis (Exact Financial Formulas):\n"
            "  - AV (Asset Value): Total dollar value of the asset.\n"
            "  - EF (Exposure Factor): Percentage of asset value lost in a single incident (0.0 to 1.0).\n"
            "  - SLE (Single Loss Expectancy): Cost of a single incident -> `SLE = AV * EF`\n"
            "  - ARO (Annualized Rate of Occurrence): Expected number of times the event happens per year.\n"
            "  - ALE (Annualized Loss Expectancy): Expected annual financial loss -> `ALE = SLE * ARO = AV * EF * ARO`\n"
            "• Risk Strategies (Treatment):\n"
            "  - Mitigate (Modify): Apply security controls to reduce likelihood/impact below Risk Appetite.\n"
            "  - Transfer (Share): Shift financial impact to third party (Cyber insurance, outsourcing).\n"
            "  - Accept: Formally acknowledge residual risk when control cost exceeds ALE.\n"
            "  - Avoid: Cease the risky business activity altogether.\n"
            "• Business Impact Analysis (BIA): Identifies critical business functions, MTD (Maximum Tolerable Downtime), RTO, RPO, WRT (Work Recovery Time), MTBF (Mean Time Between Failures), MTTR (Mean Time To Repair)."
        ),
    },
    {
        "objective": "5.3",
        "domain": "5.0",
        "title": "Explain the processes associated with third-party risk assessment and management",
        "labex_covered": False,
        "content": (
            "• Vendor Assessment: Penetration testing, Right-to-audit clauses, Internal audits, Independent assessments (SOC 2 Type II), Supply chain analysis (SBOM).\n"
            "• Vendor Agreements & Contracts:\n"
            "  - SLA (Service-Level Agreement): Defines measurable uptime, response time, and financial penalties.\n"
            "  - NDA (Non-Disclosure Agreement): Legal contract protecting confidential information.\n"
            "  - MSA (Master Service Agreement): Umbrella contract governing long-term legal terms between parties.\n"
            "  - SOW / WO (Statement of Work / Work Order): Project-specific deliverables, milestones, and pricing under an MSA.\n"
            "  - MOU / MOA (Memorandum of Understanding / Agreement): Expresses mutual intent to work together (less formal than a contract).\n"
            "  - BPA (Business Partners Agreement): Defines profit-sharing and responsibilities between partners.\n"
            "  - ISA (Interconnection Security Agreement): Technical security requirements for connecting two organizations' networks."
        ),
    },
    {
        "objective": "5.4",
        "domain": "5.0",
        "title": "Summarize elements of effective security compliance",
        "labex_covered": True,
        "content": (
            "• Compliance Reporting (Internal vs External), Consequences of non-compliance (Fines, sanctions, reputational damage, loss of license/contractual termination).\n"
            "• Key Regulations & Standards:\n"
            "  - GDPR (General Data Protection Regulation): EU data privacy law; 72-hour breach notification, Right to be Forgotten (Erasure), Data Subject rights.\n"
            "  - PCI-DSS (Payment Card Industry Data Security Standard): Contractual standard for entities handling credit card data (PAN/CVV).\n"
            "  - HIPAA (Health Insurance Portability and Accountability Act): US law protecting electronic Protected Health Information (ePHI).\n"
            "  - SOX (Sarbanes-Oxley Act): Financial reporting and IT internal controls for US public companies.\n"
            "  - COPPA / FERPA / GLBA: Children's online privacy, student educational records, financial institutions."
        ),
    },
    {
        "objective": "5.5",
        "domain": "5.0",
        "title": "Explain types and purposes of audits and assessments",
        "labex_covered": True,
        "content": (
            "• Attestation, Internal Audits (Compliance, Audit committee, Self-assessments), External Audits (Regulatory, SOC 2 Type I [design at a point in time] vs SOC 2 Type II [operating effectiveness over 6–12 months]).\n"
            "• Penetration Testing Rules of Engagement (RoE): Scope, allowed hours, emergency contacts, authorization letter ('Get out of jail free' card).\n"
            "• Teams:\n"
            "  - Red Team: Offensive attackers simulating real adversaries.\n"
            "  - Blue Team: Defensive SOC/IR team protecting infrastructure.\n"
            "  - Purple Team: Collaborative exercises pairing Red and Blue teams to tune detections.\n"
            "  - White Team: Referees/management setting rules of engagement."
        ),
    },
    {
        "objective": "5.6",
        "domain": "5.0",
        "title": "Given a scenario, implement security awareness practices",
        "labex_covered": False,
        "content": (
            "• Phishing Simulations: Controlled internal phishing campaigns to measure click rates and assign targeted training.\n"
            "• Anomalous Behavior Recognition: Risky, Unexpected, and Unintentional user behaviors (clicking links, plugging in unknown USBs, sharing passwords).\n"
            "• User Guidance & Training: Insider threat indicators, Password management (password managers), Removable media, Social engineering, Operational security (clean desk policy), Hybrid/Remote work environments."
        ),
    },
]

# Exam-Critical Ports & Protocols Table
SECURITY_PLUS_PORTS: list[dict[str, Any]] = [
    {"port": "20 / 21", "protocol": "TCP", "service": "FTP (File Transfer Protocol)", "security": "INSECURE (Cleartext credentials & data; replace with SFTP [22] or FTPS [989/990])"},
    {"port": "22", "protocol": "TCP", "service": "SSH / SFTP / SCP", "security": "SECURE (Encrypted remote shell & file transfer)"},
    {"port": "23", "protocol": "TCP", "service": "Telnet", "security": "INSECURE (Cleartext remote shell; replace with SSH [22])"},
    {"port": "25", "protocol": "TCP", "service": "SMTP (Simple Mail Transfer Protocol)", "security": "Unencrypted server-to-server mail relay unless STARTTLS is negotiated"},
    {"port": "49", "protocol": "TCP", "service": "TACACS+", "security": "SECURE AAA protocol (encrypts entire payload, separates AAA)"},
    {"port": "53", "protocol": "UDP / TCP", "service": "DNS (Domain Name System)", "security": "UDP 53 for standard queries; TCP 53 for zone transfers & large DNSSEC responses; DoT uses TCP 853, DoH uses TCP 443"},
    {"port": "67 / 68", "protocol": "UDP", "service": "DHCP (Server 67 / Client 68)", "security": "Vulnerable to Rogue DHCP & DHCP Starvation; mitigate with DHCP Snooping"},
    {"port": "69", "protocol": "UDP", "service": "TFTP (Trivial File Transfer Protocol)", "security": "INSECURE (Unauthenticated UDP file transfer used for network boot/configs)"},
    {"port": "80", "protocol": "TCP", "service": "HTTP", "security": "INSECURE (Cleartext web traffic; replace with HTTPS [443])"},
    {"port": "88", "protocol": "UDP / TCP", "service": "Kerberos", "security": "SECURE Active Directory ticket-based mutual authentication"},
    {"port": "110", "protocol": "TCP", "service": "POP3", "security": "INSECURE (Cleartext mail retrieval; replace with POP3S [995])"},
    {"port": "123", "protocol": "UDP", "service": "NTP (Network Time Protocol)", "security": "Critical for SIEM log correlation & Kerberos ticket validity"},
    {"port": "137-139", "protocol": "UDP / TCP", "service": "NetBIOS", "security": "Legacy Windows naming/session service; disable on modern networks"},
    {"port": "143", "protocol": "TCP", "service": "IMAP", "security": "INSECURE (Cleartext mail sync; replace with IMAPS [993])"},
    {"port": "161 / 162", "protocol": "UDP", "service": "SNMP (Agent 161 / Trap 162)", "security": "SNMPv1/v2c use cleartext community strings; ALWAYS use SNMPv3 (encrypted authPriv)"},
    {"port": "389", "protocol": "TCP / UDP", "service": "LDAP (Lightweight Directory Access Protocol)", "security": "INSECURE unless StartTLS; replace with LDAPS [636]"},
    {"port": "443", "protocol": "TCP / UDP", "service": "HTTPS (TLS / QUIC HTTP/3)", "security": "SECURE encrypted web traffic & DNS-over-HTTPS (DoH)"},
    {"port": "445", "protocol": "TCP", "service": "SMB (Server Message Block)", "security": "Windows file sharing; block at perimeter firewall (EternalBlue / WannaCry vector); enforce SMBv3 signing/encryption"},
    {"port": "465 / 587", "protocol": "TCP", "service": "SMTPS / SMTP Submission with TLS", "security": "SECURE authenticated client mail submission"},
    {"port": "500 / 4500", "protocol": "UDP", "service": "ISAKMP / IKEv2 & IPsec NAT-T", "security": "SECURE VPN key exchange & NAT traversal"},
    {"port": "514", "protocol": "UDP", "service": "Syslog", "security": "Unencrypted log transport; use Syslog over TLS on TCP 6514"},
    {"port": "636", "protocol": "TCP", "service": "LDAPS (LDAP over TLS/SSL)", "security": "SECURE directory services queries"},
    {"port": "853", "protocol": "TCP", "service": "DNS over TLS (DoT)", "security": "SECURE encrypted DNS resolution"},
    {"port": "989 / 990", "protocol": "TCP", "service": "FTPS (FTP over TLS - Data 989 / Control 990)", "security": "SECURE TLS-wrapped FTP"},
    {"port": "993", "protocol": "TCP", "service": "IMAPS (IMAP over TLS)", "security": "SECURE email synchronization"},
    {"port": "995", "protocol": "TCP", "service": "POP3S (POP3 over TLS)", "security": "SECURE email retrieval"},
    {"port": "1433", "protocol": "TCP", "service": "Microsoft SQL Server", "security": "Database port; never expose to public internet"},
    {"port": "1812 / 1813", "protocol": "UDP", "service": "RADIUS (Auth 1812 / Accounting 1813)", "security": "SECURE 802.1X / Enterprise Wi-Fi AAA (also UDP 1645/1646 legacy)"},
    {"port": "3260", "protocol": "TCP", "service": "iSCSI", "security": "IP-based SAN block storage; isolate on dedicated storage VLAN with CHAP"},
    {"port": "3306", "protocol": "TCP", "service": "MySQL / MariaDB", "security": "Database port; restrict to application tier only"},
    {"port": "3389", "protocol": "TCP / UDP", "service": "RDP (Remote Desktop Protocol)", "security": "High-risk ransomware vector if exposed; place behind VPN/Jump Host + NLA + MFA"},
    {"port": "5060 / 5061", "protocol": "UDP / TCP", "service": "SIP (VoIP - 5060 cleartext / 5061 SIPS TLS)", "security": "Use 5061 TLS + SRTP to prevent VoIP call eavesdropping"},
    {"port": "6514", "protocol": "TCP", "service": "Syslog over TLS", "security": "SECURE encrypted SIEM log ingestion"},
]

# Key Security+ Acronyms
SECURITY_PLUS_ACRONYMS: dict[str, str] = {
    "AAA": "Authentication, Authorization, and Accounting",
    "ABAC": "Attribute-Based Access Control (evaluates user, resource, environment attributes)",
    "ACL": "Access Control List",
    "AES": "Advanced Encryption Standard (128/192/256-bit symmetric block cipher)",
    "AH": "Authentication Header (IPsec protocol providing integrity/auth, NOT confidentiality)",
    "AIS": "Automated Indicator Sharing (CISA threat feed exchange)",
    "ALE": "Annualized Loss Expectancy (ALE = SLE * ARO)",
    "APT": "Advanced Persistent Threat (stealthy, well-funded nation-state actor)",
    "ARO": "Annualized Rate of Occurrence",
    "ARP": "Address Resolution Protocol (maps IP to MAC; vulnerable to ARP poisoning)",
    "ASLR": "Address Space Layout Randomization (randomizes memory locations to defeat buffer overflows)",
    "AUP": "Acceptable Use Policy",
    "AV": "Asset Value (or Antivirus)",
    "BCP": "Business Continuity Plan",
    "BEC": "Business Email Compromise",
    "BGP": "Border Gateway Protocol (internet routing protocol)",
    "BIA": "Business Impact Analysis",
    "BPA": "Business Partners Agreement",
    "BYOD": "Bring Your Own Device",
    "CA": "Certificate Authority",
    "CASB": "Cloud Access Security Broker (enforces security policies between users and cloud SaaS)",
    "CER": "Crossover Error Rate (where biometric FAR equals FRR; lower is better)",
    "CIA": "Confidentiality, Integrity, and Availability",
    "CIS": "Center for Internet Security (publishes hardening benchmarks)",
    "COOP": "Continuity of Operations Planning",
    "COPE": "Corporate-Owned, Personally Enabled",
    "CRL": "Certificate Revocation List",
    "CSRF": "Cross-Site Request Forgery",
    "CSR": "Certificate Signing Request",
    "CVE": "Common Vulnerabilities and Exposures",
    "CVSS": "Common Vulnerability Scoring System (0.0 to 10.0)",
    "CYOD": "Choose Your Own Device",
    "DAC": "Discretionary Access Control (owner controls permissions)",
    "DAST": "Dynamic Application Security Testing (black-box runtime testing)",
    "DDoS": "Distributed Denial of Service",
    "DEP": "Data Execution Prevention (marks memory regions non-executable)",
    "DKIM": "DomainKeys Identified Mail (cryptographic email signature)",
    "DLP": "Data Loss Prevention",
    "DMARC": "Domain-based Message Authentication, Reporting, and Conformance",
    "DMZ": "Demilitarized Zone / Screened Subnet",
    "DNSSEC": "Domain Name System Security Extensions",
    "DPO": "Data Protection Officer",
    "DRP": "Disaster Recovery Plan",
    "EAP-TLS": "Extensible Authentication Protocol - Transport Layer Security (mutual cert Wi-Fi auth)",
    "ECC": "Elliptic Curve Cryptography (smaller keys with equivalent strength to RSA)",
    "ECDHE": "Elliptic Curve Diffie-Hellman Ephemeral (provides Perfect Forward Secrecy)",
    "EDR": "Endpoint Detection and Response",
    "EF": "Exposure Factor (percentage of asset lost in single event)",
    "ESP": "Encapsulating Security Payload (IPsec protocol providing encryption + integrity)",
    "FAR": "False Acceptance Rate (biometric Type II error - unauthorized user accepted)",
    "FDE": "Full-Disk Encryption (BitLocker, LUKS, FileVault)",
    "FIM": "File Integrity Monitoring (AIDE, Tripwire, OSSEC)",
    "FRR": "False Rejection Rate (biometric Type I error - legitimate user rejected)",
    "GDPR": "General Data Protection Regulation",
    "GPG": "GNU Privacy Guard",
    "GPO": "Group Policy Object",
    "HIPAA": "Health Insurance Portability and Accountability Act",
    "HMAC": "Hash-based Message Authentication Code",
    "HSM": "Hardware Security Module",
    "IaC": "Infrastructure as Code",
    "IAM": "Identity and Access Management",
    "ICS": "Industrial Control System",
    "IdP": "Identity Provider",
    "IDS": "Intrusion Detection System (passive alert)",
    "IPS": "Intrusion Prevention System (inline block)",
    "IoC": "Indicator of Compromise",
    "IoT": "Internet of Things",
    "ISA": "Interconnection Security Agreement",
    "ISO": "International Organization for Standardization (e.g., ISO/IEC 27001)",
    "JIT": "Just-in-Time Access",
    "LDAP": "Lightweight Directory Access Protocol",
    "MAC": "Mandatory Access Control (SELinux/labels) or Media Access Control (NIC hardware address)",
    "MDM": "Mobile Device Management",
    "MFA": "Multi-Factor Authentication",
    "MOA": "Memorandum of Agreement",
    "MOU": "Memorandum of Understanding",
    "MSA": "Master Service Agreement",
    "MSP": "Managed Service Provider",
    "MTBF": "Mean Time Between Failures (reliability metric)",
    "MTD": "Maximum Tolerable Downtime",
    "MTTR": "Mean Time To Repair / Recover",
    "NAC": "Network Access Control (802.1X)",
    "NDA": "Non-Disclosure Agreement",
    "NGFW": "Next-Generation Firewall",
    "NIST": "National Institute of Standards and Technology",
    "OCSP": "Online Certificate Status Protocol",
    "OIDC": "OpenID Connect (JSON identity layer on OAuth 2.0)",
    "OSINT": "Open-Source Intelligence",
    "OT": "Operational Technology (SCADA/PLCs)",
    "OWASP": "Open Worldwide Application Security Project",
    "PAM": "Privileged Access Management (or Pluggable Authentication Modules in Linux)",
    "PBKDF2": "Password-Based Key Derivation Function 2",
    "PCI-DSS": "Payment Card Industry Data Security Standard",
    "PDP": "Policy Decision Point (Zero Trust Control Plane)",
    "PEP": "Policy Enforcement Point (Zero Trust Data Plane)",
    "PFS": "Perfect Forward Secrecy",
    "PHI": "Protected Health Information",
    "PII": "Personally Identifiable Information",
    "PKI": "Public Key Infrastructure",
    "PLC": "Programmable Logic Controller",
    "RADIUS": "Remote Authentication Dial-In User Service",
    "RAID": "Redundant Array of Independent Disks",
    "RBAC": "Role-Based Access Control",
    "RDP": "Remote Desktop Protocol",
    "RoE": "Rules of Engagement",
    "RPO": "Recovery Point Objective (max acceptable data loss measured in time)",
    "RTO": "Recovery Time Objective (max acceptable service downtime)",
    "RTOS": "Real-Time Operating System",
    "SAE": "Simultaneous Authentication of Equals (WPA3 Dragonfly handshake)",
    "SAML": "Security Assertion Markup Language (XML SSO)",
    "SAN": "Storage Area Network (or Subject Alternative Name in X.509 certificates)",
    "SASE": "Secure Access Service Edge",
    "SAST": "Static Application Security Testing (white-box source code analysis)",
    "SBOM": "Software Bill of Materials",
    "SCADA": "Supervisory Control and Data Acquisition",
    "SCAP": "Security Content Automation Protocol",
    "SD-WAN": "Software-Defined Wide Area Network",
    "SDLC": "Software Development Life Cycle",
    "SED": "Self-Encrypting Drive",
    "SIEM": "Security Information and Event Management",
    "SLA": "Service-Level Agreement",
    "SLE": "Single Loss Expectancy (SLE = AV * EF)",
    "SMB": "Server Message Block",
    "SMS": "Short Message Service",
    "SNMP": "Simple Network Management Protocol",
    "SOAR": "Security Orchestration, Automation, and Response",
    "SOC": "Security Operations Center (or System and Organization Controls [SOC 2])",
    "SOW": "Statement of Work",
    "SPF": "Sender Policy Framework",
    "SQLi": "SQL Injection",
    "SRTP": "Secure Real-time Transport Protocol",
    "SSRF": "Server-Side Request Forgery",
    "SSO": "Single Sign-On",
    "STIX": "Structured Threat Information Expression",
    "SWG": "Secure Web Gateway",
    "TACACS+": "Terminal Access Controller Access-Control System Plus",
    "TAXII": "Trusted Automated Exchange of Intelligence Information",
    "TLS": "Transport Layer Security",
    "TOCTOU": "Time of Check to Time of Use (race condition)",
    "TOTP": "Time-based One-Time Password (RFC 6238)",
    "TPM": "Trusted Platform Module",
    "TTP": "Tactics, Techniques, and Procedures",
    "UEBA": "User and Entity Behavior Analytics",
    "UPS": "Uninterruptible Power Supply",
    "VLAN": "Virtual Local Area Network",
    "VPN": "Virtual Private Network",
    "WAF": "Web Application Firewall",
    "WPA3": "Wi-Fi Protected Access 3",
    "XDR": "Extended Detection and Response",
    "XSS": "Cross-Site Scripting",
    "ZTNA": "Zero Trust Network Access",
}

# Practice Questions & PBQ Scenarios with Detailed Explanations
SECURITY_PLUS_PRACTICE_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "Q01",
        "domain": "1.0",
        "objective": "1.1",
        "question": (
            "A Chief Information Security Officer (CISO) wants to secure a legacy industrial controller that runs an "
            "unsupported operating system and cannot have endpoint antivirus installed or patches applied. The network "
            "team places the controller into an isolated VLAN behind an inline IPS with strict allowlisting. Which type "
            "of security control has been implemented?"
        ),
        "options": [
            "A. Corrective control",
            "B. Compensating control",
            "C. Directive control",
            "D. Deterrent control",
        ],
        "answer": "B",
        "explanation": (
            "Correct Answer: B (Compensating control). A compensating control is an alternative control put in place "
            "when a primary control (patching or installing EDR on a legacy OS) is technically or operationally infeasible. "
            "Isolating the asset in a segmented VLAN behind an IPS mitigates the risk without modifying the legacy host. "
            "Why others are wrong: Corrective (A) restores systems after an incident; Directive (C) is a policy/sign; "
            "Deterrent (D) discourages attackers psychologically."
        ),
        "source": "CompTIA Security+ SY0-701 Objective 1.1 & LabEx Lab 10",
    },
    {
        "id": "Q02",
        "domain": "1.0",
        "objective": "1.2",
        "question": (
            "In a Zero Trust Architecture (NIST SP 800-207), an employee attempts to access an internal financial API. "
            "The system evaluates the user's identity, device posture, and geolocation before instructing the gateway "
            "to open an encrypted micro-session. Which component makes the access decision, and in which plane does it reside?"
        ),
        "options": [
            "A. Policy Enforcement Point (PEP) in the Data Plane",
            "B. Policy Engine (PE) / Policy Decision Point (PDP) in the Control Plane",
            "C. Hardware Security Module (HSM) in the Physical Plane",
            "D. Honeytoken Collector in the Deception Plane",
        ],
        "answer": "B",
        "explanation": (
            "Correct Answer: B (Policy Engine / Policy Decision Point in the Control Plane). In Zero Trust, the Control Plane "
            "houses the Policy Engine (PE) and Policy Administrator (PA), together forming the Policy Decision Point (PDP) "
            "that evaluates adaptive identity, device health, and context. Once decided, it signals the Policy Enforcement "
            "Point (PEP) in the Data Plane (A) to allow or terminate the session."
        ),
        "source": "CompTIA Security+ SY0-701 Objective 1.2 (Zero Trust Control/Data Planes)",
    },
    {
        "id": "Q03",
        "domain": "1.0",
        "objective": "1.4",
        "question": (
            "Alice wants to send a sensitive contract to Bob over an untrusted network. She needs to guarantee both "
            "Confidentiality (only Bob can read it) and Non-Repudiation (Bob can mathematically prove Alice sent it and "
            "that it was not altered). How should Alice use asymmetric cryptography?"
        ),
        "options": [
            "A. Sign with Bob's public key, then encrypt with Alice's private key",
            "B. Sign the hash with Alice's private key, then encrypt the payload using Bob's public key",
            "C. Encrypt with SHA-256, then sign with Bob's private key",
            "D. Sign with Alice's public key, then encrypt with AES shared in cleartext",
        ],
        "answer": "B",
        "explanation": (
            "Correct Answer: B. Digital signatures provide Integrity + Authentication + Non-Repudiation: Alice hashes "
            "the document and signs the hash with her own PRIVATE key (which only Alice possesses; Bob verifies with "
            "Alice's public key). For Confidentiality, Alice encrypts the message using Bob's PUBLIC key (or a hybrid "
            "AES session key wrapped in Bob's public key) so only Bob's private key can decrypt it."
        ),
        "source": "LabEx Lab 06 (Ensuring Data Integrity and Authenticity with Cryptography) & SY0-701 Objective 1.4",
    },
    {
        "id": "Q04",
        "domain": "2.0",
        "objective": "2.4",
        "question": (
            "A SOC analyst notices that multiple employee accounts are experiencing 1 single failed login attempt every "
            "45 minutes from the same rotating residential proxy network, using `Summer2026!`. No accounts have been "
            "locked out by the 5-strike threshold. Which attack is occurring?"
        ),
        "options": [
            "A. Credential Stuffing",
            "B. Password Spraying",
            "C. Rainbow Table Attack",
            "D. Pass-the-Hash",
        ],
        "answer": "B",
        "explanation": (
            "Correct Answer: B (Password Spraying). Password spraying tests one or a few common passwords (`Summer2026!`) "
            "against many different usernames slowly to stay below the account lockout threshold. Credential Stuffing (A) "
            "reuses leaked username:password pairs from third-party breaches; Rainbow Tables (C) crack offline unsalted "
            "hashes; Pass-the-Hash (D) authenticates using stolen NTLM/LM hashes without knowing the cleartext password."
        ),
        "source": "LabEx Lab 03 (Password Policies and Detecting Attack in Linux) & SY0-701 Objective 2.4",
    },
    {
        "id": "Q05",
        "domain": "3.0",
        "objective": "3.2",
        "question": (
            "A company is upgrading its corporate Wi-Fi from WPA2-PSK to WPA3-Personal. What cryptographic improvement "
            "does WPA3-Personal introduce to prevent attackers who capture the initial association handshake from "
            "performing offline dictionary attacks?"
        ),
        "options": [
            "A. TKIP (Temporal Key Integrity Protocol)",
            "B. WEP 128-bit IV initialization",
            "C. SAE (Simultaneous Authentication of Equals / Dragonfly handshake)",
            "D. WPS 8-digit PIN exchange",
        ],
        "answer": "C",
        "explanation": (
            "Correct Answer: C (SAE / Simultaneous Authentication of Equals). WPA3 replaces the vulnerable WPA2 4-way "
            "PSK handshake with SAE (Dragonfly key exchange), which provides forward secrecy and prevents offline "
            "dictionary/brute-force cracking against captured handshakes."
        ),
        "source": "CompTIA Security+ SY0-701 Objective 3.2 & 4.1",
    },
    {
        "id": "Q06",
        "domain": "4.0",
        "objective": "4.5",
        "question": (
            "Customers report receiving spoofed phishing emails that appear to come from `support@starkindustries.com`. "
            "The administrator has already published a DNS TXT record listing authorized mail server IPs and configured "
            "cryptographic header signing on the mail gateway. What must be configured NEXT to instruct receiving mail "
            "servers to reject messages that fail these checks and send aggregate XML reports back?"
        ),
        "options": [
            "A. DNSSEC",
            "B. DMARC with `p=reject` and `rua=` reporting",
            "C. S/MIME client certificates",
            "D. OCSP Stapling",
        ],
        "answer": "B",
        "explanation": (
            "Correct Answer: B (DMARC). The administrator already configured SPF (authorized outbound IPs in DNS TXT) "
            "and DKIM (cryptographic email header signature). DMARC binds SPF and DKIM together, specifies the enforcement "
            "policy (`p=none`, `p=quarantine`, or `p=reject`), and defines where aggregate (`rua`) and forensic (`ruf`) "
            "reports should be sent."
        ),
        "source": "CompTIA Security+ SY0-701 Objective 4.5",
    },
    {
        "id": "Q07",
        "domain": "4.0",
        "objective": "4.8",
        "question": (
            "A forensic responder arrives at a live Linux web server suspected of running an in-memory fileless rootkit. "
            "According to the Order of Volatility (RFC 3227), in what order should evidence be collected from MOST "
            "volatile to LEAST volatile?"
        ),
        "options": [
            "A. Hard disk image -> System RAM -> CPU registers -> Offsite backup tapes",
            "B. CPU registers/cache -> RAM & routing/ARP tables -> Swap/temp file systems -> Local SSD/Disk -> Remote logs/Archival media",
            "C. Remote SIEM logs -> Local SSD -> RAM -> CPU cache",
            "D. Power off the server immediately, then run `dd` on the SSD",
        ],
        "answer": "B",
        "explanation": (
            "Correct Answer: B. RFC 3227 Order of Volatility mandates capturing the most ephemeral evidence first: "
            "1) CPU registers and cache, 2) System RAM, active network connections, ARP/routing tables, 3) Temporary "
            "filesystems/swap space, 4) Non-volatile local disk (`dd` bit-stream image), 5) Remote logging/monitoring data, "
            "and 6) Physical configuration/archival backup media."
        ),
        "source": "LabEx Lab 13 (Digital Forensics Evidence Acquisition and Integrity) & SY0-701 Objective 4.8",
    },
    {
        "id": "Q08",
        "domain": "5.0",
        "objective": "5.2",
        "question": (
            "A quantitative risk assessment values an e-commerce database server at $200,000 (AV). Historical data "
            "shows that a severe power surge occurs once every 4 years and destroys 25% of the server's value (EF = 0.25). "
            "What are the Single Loss Expectancy (SLE) and the Annualized Loss Expectancy (ALE)?"
        ),
        "options": [
            "A. SLE = $50,000; ALE = $12,500",
            "B. SLE = $200,000; ALE = $50,000",
            "C. SLE = $12,500; ALE = $50,000",
            "D. SLE = $50,000; ALE = $200,000",
        ],
        "answer": "A",
        "explanation": (
            "Correct Answer: A (SLE = $50,000; ALE = $12,500).\n"
            "• Step 1: Calculate SLE = AV * EF = $200,000 * 0.25 = $50,000.\n"
            "• Step 2: Determine ARO = 1 event per 4 years = 0.25 per year.\n"
            "• Step 3: Calculate ALE = SLE * ARO = $50,000 * 0.25 = $12,500 per year.\n"
            "Therefore, spending up to $12,500/year on UPS/surge suppression is cost-justified."
        ),
        "source": "CompTIA Security+ SY0-701 Objective 5.2 (Quantitative Risk Analysis)",
    },
]

# Interactive PBQ (Performance-Based Question) Scenarios
SECURITY_PLUS_PBQ_SCENARIOS: list[dict[str, Any]] = [
    {
        "pbq_id": "PBQ-01",
        "title": "SIEM Log Triage & Attack Classification + Immediate Containment",
        "domain": "4.0",
        "objective": "4.4 / 4.8",
        "scenario": (
            "Examine the following 3 log snippets captured on a production Linux server (`10.20.30.15`):\n"
            "Log A (`/var/log/nginx/access.log`): `198.51.100.42 - GET /products.php?id=1'%20UNION%20SELECT%20username,password_hash%20FROM%20users-- HTTP/1.1 200`\n"
            "Log B (`/var/log/auth.log`): `Nov 07 03:11:02 web01 sshd[4192]: Failed password for invalid user admin from 203.0.113.88 port 51922 ssh2 (repeated 480 times in 60s)`\n"
            "Log C (`/var/log/nginx/access.log`): `192.0.2.77 - GET /download?file=../../../../etc/shadow HTTP/1.1 403`"
        ),
        "tasks": [
            "Identify the exact attack type in Log A, Log B, and Log C.",
            "Determine which attack succeeded based on the HTTP status code.",
            "Provide the exact remediation for each vulnerability.",
        ],
        "solution": {
            "Log A": "SQL Injection (SQLi - UNION-based). HTTP 200 indicates the attack SUCCEEDED and returned data! Remediation: Parameterized queries / prepared statements + WAF.",
            "Log B": "SSH Brute-Force / Dictionary Attack. Remediation: Deploy `fail2ban`, disable `PasswordAuthentication` in `/etc/ssh/sshd_config`, enforce Ed25519 SSH keys + MFA.",
            "Log C": "Directory Traversal (Path Traversal / Local File Inclusion attempt). HTTP 403 indicates the server blocked access to `/etc/shadow`. Remediation: Input sanitization (`basename`), chroot jail, least-privilege service account.",
        },
        "source": "LabEx Lab 03, Lab 05 & Lab 12 + CompTIA SY0-701 Objective 2.3 & 4.4",
    },
    {
        "pbq_id": "PBQ-02",
        "title": "Enterprise DMZ / Screened Subnet Firewall Rule Table Configuration",
        "domain": "3.0",
        "objective": "3.2",
        "scenario": (
            "You are configuring a stateless perimeter & internal firewall rule set for a 3-tier enterprise architecture:\n"
            "• Public Web Server in DMZ: `172.16.10.10`\n"
            "• Internal MySQL Database Server in Private VLAN: `10.10.50.20`\n"
            "• Admin Jump Box in Management VLAN: `10.10.99.5`"
        ),
        "tasks": [
            "Rule 1: Allow internet users (`0.0.0.0/0`) to browse the DMZ Web Server securely.",
            "Rule 2: Allow the DMZ Web Server to query the Internal MySQL Database.",
            "Rule 3: Allow the Admin Jump Box to manage both servers via SSH.",
            "Rule 4: Enforce Implicit Deny for all other traffic.",
        ],
        "solution": {
            "Rule 1": "ALLOW | Proto: TCP | Src: ANY (0.0.0.0/0) | Dst: 172.16.10.10 | Port: 443 (HTTPS)",
            "Rule 2": "ALLOW | Proto: TCP | Src: 172.16.10.10 | Dst: 10.10.50.20 | Port: 3306 (MySQL)",
            "Rule 3": "ALLOW | Proto: TCP | Src: 10.10.99.5 | Dst: 172.16.10.10, 10.10.50.20 | Port: 22 (SSH)",
            "Rule 4": "DENY  | Proto: ANY | Src: ANY | Dst: ANY | Port: ANY (Implicit Deny All)",
        },
        "source": "LabEx Lab 10 & Lab 11 + CompTIA SY0-701 Objective 3.2",
    },
]

# Cybersecurity Frameworks Matrix
SECURITY_PLUS_FRAMEWORKS: list[dict[str, str]] = [
    {
        "name": "NIST Cybersecurity Framework (CSF) 2.0",
        "core_functions": "6 Core Functions: Govern (Added in 2.0), Identify, Protect, Detect, Respond, Recover",
        "purpose": "Voluntary risk-based framework for organizing and improving an enterprise cybersecurity program.",
    },
    {
        "name": "NIST SP 800-61r2 (Incident Handling Guide)",
        "core_functions": "4 Phases: 1) Preparation, 2) Detection & Analysis, 3) Containment, Eradication & Recovery, 4) Post-Incident Activity",
        "purpose": "Standard incident response lifecycle tested heavily on CompTIA Security+ SY0-701.",
    },
    {
        "name": "SANS Incident Handler's Handbook (PICERL)",
        "core_functions": "6 Phases: Preparation, Identification, Containment, Eradication, Recovery, Lessons Learned",
        "purpose": "Alternative 6-step Incident Response mnemonic.",
    },
    {
        "name": "MITRE ATT&CK Framework",
        "core_functions": "Tactics (Why), Techniques (How), and Sub-techniques / Procedures (TTPs) from Reconnaissance to Impact",
        "purpose": "Knowledge base of real-world adversary behaviors used for threat hunting and SOC detection engineering.",
    },
    {
        "name": "Lockheed Martin Cyber Kill Chain",
        "core_functions": "7 Stages: 1) Reconnaissance, 2) Weaponization, 3) Delivery, 4) Exploitation, 5) Installation, 6) Command & Control (C2), 7) Actions on Objectives",
        "purpose": "Models the sequential stages of an external cyber intrusion.",
    },
    {
        "name": "The Diamond Model of Intrusion Analysis",
        "core_functions": "4 Core Features: Adversary, Capability, Infrastructure, Victim (+ Meta-features: Timestamp, Phase, Result, Direction)",
        "purpose": "Analytical model for threat intelligence attribution and pivot analysis.",
    },
    {
        "name": "ISO/IEC 27001 / 27002 / 27701",
        "core_functions": "27001 = ISMS Requirements (Certifiable); 27002 = Code of Practice for Controls; 27701 = Privacy Information Management (PIMS)",
        "purpose": "International standards for establishing and certifying an Information Security Management System (ISMS).",
    },
    {
        "name": "CIS Critical Security Controls & Benchmarks",
        "core_functions": "18 prioritized security controls (IG1, IG2, IG3) + OS/Cloud/Docker hardening checklists",
        "purpose": "Actionable technical hardening standards.",
    },
]


def _tokenize_and_embed(text: str, dim: int = 128) -> list[float]:
    """Deterministic, high-speed hashed feature + trigram vector embedding (L2-normalized)."""
    vec = [0.0] * dim
    clean = re.sub(r"[^a-z0-9_+./\-]", " ", text.lower())
    tokens = [t for t in clean.split() if len(t) >= 2]
    for tok in tokens:
        # Word unigram
        h1 = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:8], 16)
        idx1 = h1 % dim
        sign1 = 1.0 if (h1 & (1 << 16)) else -1.0
        # Boost exact acronyms, ports, and objective numbers
        weight = 2.5 if (tok.isdigit() or "." in tok or len(tok) <= 5) else 1.5
        vec[idx1] += sign1 * weight
        # Character 3-grams for fuzzy/morphological matching
        if len(tok) >= 4:
            for i in range(len(tok) - 2):
                tri = tok[i : i + 3]
                h2 = int(hashlib.md5(tri.encode("utf-8")).hexdigest()[:8], 16)
                vec[h2 % dim] += 0.4
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


def _cosine_similarity(v1: list[float], v2: list[float]) -> float:
    return sum(a * b for a, b in zip(v1, v2))


def parse_cloned_labex_readme() -> list[dict[str, Any]]:
    """Parses the cloned LabEx README.md and merges with full hands-on command & concept enrichments."""
    readme_path = LABEX_REPO_DIR / "README.md"
    parsed_rows: dict[str, dict[str, str]] = {}
    if readme_path.is_file():
        raw = readme_path.read_text(encoding="utf-8", errors="ignore")
        for line in raw.splitlines():
            if line.strip().startswith("|") and "labex.io/labs/" in line:
                parts = [p.strip() for p in line.strip("|").split("|")]
                if len(parts) >= 4:
                    idx = parts[0].zfill(2)
                    name = parts[1]
                    diff = parts[2]
                    url_match = re.search(r"href=['\"]([^'\"]+)['\"]", parts[3])
                    url = url_match.group(1) if url_match else ""
                    parsed_rows[idx] = {
                        "index": idx,
                        "readme_name": name,
                        "difficulty": diff,
                        "url": url,
                    }

    merged: list[dict[str, Any]] = []
    for item in LABEX_ENRICHED_LABS:
        idx = item["index"]
        from_repo = parsed_rows.get(idx, {})
        url = from_repo.get(
            "url",
            f"https://labex.io/labs/{item['slug']}?course=comptia-security-plus-training-labs",
        )
        merged.append(
            {
                "index": idx,
                "title": item["title"],
                "readme_name": from_repo.get("readme_name", item["title"]),
                "difficulty": from_repo.get("difficulty", "Beginner"),
                "url": url,
                "domain": item["domain"],
                "objectives": item["objectives"],
                "concepts": item["concepts"],
                "commands": item["commands"],
                "explanation": item["explanation"],
                "source_citation": f"LabEx CompTIA Security+ Lab {idx}: {item['title']} ({url})",
            }
        )
    return merged


class SecurityPlusRAG:
    """Persistent SQLite + Vector Cosine-Similarity + Keyword BM25 Hybrid RAG for CompTIA Security+ (SY0-701)."""

    def __init__(self, db_path: Path | None = None):
        SECPLUS_DIR.mkdir(parents=True, exist_ok=True)
        self.db_path = db_path or RAG_DB_PATH
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        import atexit
        atexit.register(self.close)
        self._init_schema()
        self.ensure_populated()

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS rag_documents (
                doc_id          TEXT PRIMARY KEY,
                category        TEXT NOT NULL,
                domain          TEXT,
                objective       TEXT,
                title           TEXT NOT NULL,
                content         TEXT NOT NULL,
                commands_json   TEXT,
                source_citation TEXT NOT NULL,
                source_url      TEXT,
                embedding_json  TEXT NOT NULL,
                updated_at      REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_rag_category ON rag_documents(category);
            CREATE INDEX IF NOT EXISTS idx_rag_domain ON rag_documents(domain);
            """
        )
        self._conn.commit()

    def ensure_populated(self) -> dict[str, int]:
        cur = self._conn.execute("SELECT COUNT(*) AS cnt FROM rag_documents").fetchone()
        if cur and cur["cnt"] >= 60:
            return self.get_counts()
        return self.rebuild_index()

    def rebuild_index(self) -> dict[str, int]:
        now = time.time()
        docs: list[tuple] = []

        # 1. All 14 Cloned LabEx Hands-On Labs
        labs = parse_cloned_labex_readme()
        for lab in labs:
            doc_id = f"labex_{lab['index']}"
            full_text = (
                f"LabEx Lab {lab['index']}: {lab['title']} (Domain {lab['domain']}, Objectives {', '.join(lab['objectives'])})\n"
                f"Concepts: {'; '.join(lab['concepts'])}\n"
                f"Commands:\n" + "\n".join(f"  $ {c}" for c in lab["commands"]) + "\n"
                f"Explanation: {lab['explanation']}"
            )
            emb = _tokenize_and_embed(f"{lab['title']} {full_text}")
            docs.append(
                (
                    doc_id,
                    "labex_lab",
                    lab["domain"],
                    ",".join(lab["objectives"]),
                    f"LabEx Lab {lab['index']}: {lab['title']}",
                    full_text,
                    json.dumps(lab["commands"]),
                    lab["source_citation"],
                    lab["url"],
                    json.dumps(emb),
                    now,
                )
            )

        # 2. All 28 Official SY0-701 Sub-Objectives & Gap-Fill Modules
        for obj in SY0_701_OBJECTIVES_KB:
            doc_id = f"sy0_701_obj_{obj['objective']}"
            title = f"CompTIA Security+ SY0-701 Objective {obj['objective']}: {obj['title']}"
            emb = _tokenize_and_embed(f"{title} {obj['content']}")
            docs.append(
                (
                    doc_id,
                    "exam_objective",
                    obj["domain"],
                    obj["objective"],
                    title,
                    obj["content"],
                    json.dumps([]),
                    f"CompTIA Security+ (SY0-701) Official Exam Blueprint — Domain {obj['domain']}, Objective {obj['objective']}",
                    "https://www.comptia.org/certifications/security",
                    json.dumps(emb),
                    now,
                )
            )

        # 3. Ports & Protocols chunks
        for p in SECURITY_PLUS_PORTS:
            port_slug = re.sub(r"[^a-z0-9]+", "_", p["port"].lower()).strip("_")
            doc_id = f"port_{port_slug}_{p['service'].split()[0].lower()}"
            title = f"Port {p['port']} ({p['protocol']}) — {p['service']}"
            content = f"Port: {p['port']} | Transport: {p['protocol']} | Service: {p['service']} | Security Notes: {p['security']}"
            emb = _tokenize_and_embed(f"{title} {content}")
            docs.append(
                (
                    doc_id,
                    "port_protocol",
                    "3.0/4.0",
                    "3.2/4.1",
                    title,
                    content,
                    json.dumps([]),
                    "CompTIA Security+ SY0-701 Ports & Protocols Master Reference",
                    "https://github.com/labex-labs/comptia-security-plus-training-labs",
                    json.dumps(emb),
                    now,
                )
            )

        # 4. Frameworks
        for idx, fw in enumerate(SECURITY_PLUS_FRAMEWORKS, start=1):
            doc_id = f"framework_{idx:02d}"
            title = f"Cybersecurity Framework: {fw['name']}"
            content = f"{fw['name']}\nCore Functions / Phases: {fw['core_functions']}\nPurpose: {fw['purpose']}"
            emb = _tokenize_and_embed(f"{title} {content}")
            docs.append(
                (
                    doc_id,
                    "framework",
                    "5.0",
                    "5.1/5.4",
                    title,
                    content,
                    json.dumps([]),
                    f"CompTIA Security+ SY0-701 Frameworks Reference ({fw['name']})",
                    "https://www.nist.gov/cyberframework",
                    json.dumps(emb),
                    now,
                )
            )

        # 5. Acronyms (Grouped by alphabetical ranges + full searchable entries)
        acronym_lines = [f"• {k}: {v}" for k, v in sorted(SECURITY_PLUS_ACRONYMS.items())]
        chunk_size = 25
        for i in range(0, len(acronym_lines), chunk_size):
            batch = acronym_lines[i : i + chunk_size]
            doc_id = f"acronyms_batch_{i // chunk_size + 1:02d}"
            title = f"CompTIA Security+ SY0-701 Official Acronyms (Part {i // chunk_size + 1})"
            content = "\n".join(batch)
            emb = _tokenize_and_embed(content)
            docs.append(
                (
                    doc_id,
                    "acronyms",
                    "1.0-5.0",
                    "ALL",
                    title,
                    content,
                    json.dumps([]),
                    "CompTIA Security+ SY0-701 Official Acronym List",
                    "https://www.comptia.org/certifications/security",
                    json.dumps(emb),
                    now,
                )
            )

        # 6. Practice Questions & PBQs
        for q in SECURITY_PLUS_PRACTICE_QUESTIONS:
            doc_id = f"quiz_{q['id'].lower()}"
            title = f"Practice Question {q['id']} (Domain {q['domain']}, Objective {q['objective']})"
            content = (
                f"Question: {q['question']}\nOptions:\n"
                + "\n".join(q["options"])
                + f"\nCorrect Answer: {q['answer']}\nExplanation: {q['explanation']}"
            )
            emb = _tokenize_and_embed(f"{title} {content}")
            docs.append(
                (
                    doc_id,
                    "practice_question",
                    q["domain"],
                    q["objective"],
                    title,
                    content,
                    json.dumps([]),
                    q["source"],
                    "https://labex.io/courses/comptia-security-plus-training-labs",
                    json.dumps(emb),
                    now,
                )
            )

        for pbq in SECURITY_PLUS_PBQ_SCENARIOS:
            doc_id = f"pbq_{pbq['pbq_id'].lower().replace('-', '_')}"
            title = f"Interactive PBQ {pbq['pbq_id']}: {pbq['title']}"
            content = (
                f"Scenario:\n{pbq['scenario']}\nTasks:\n"
                + "\n".join(f"- {t}" for t in pbq["tasks"])
                + "\nSolution:\n"
                + "\n".join(f"• {k}: {v}" for k, v in pbq["solution"].items())
            )
            emb = _tokenize_and_embed(f"{title} {content}")
            docs.append(
                (
                    doc_id,
                    "pbq_scenario",
                    pbq["domain"],
                    pbq["objective"],
                    title,
                    content,
                    json.dumps([]),
                    pbq["source"],
                    "https://labex.io/courses/comptia-security-plus-training-labs",
                    json.dumps(emb),
                    now,
                )
            )

        self._conn.executemany(
            """
            INSERT OR REPLACE INTO rag_documents
            (doc_id, category, domain, objective, title, content, commands_json, source_citation, source_url, embedding_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            docs,
        )
        self._conn.commit()
        return self.get_counts()

    def get_counts(self) -> dict[str, int]:
        rows = self._conn.execute(
            "SELECT category, COUNT(*) AS cnt FROM rag_documents GROUP BY category"
        ).fetchall()
        by_cat = {r["category"]: r["cnt"] for r in rows}
        total = sum(by_cat.values())
        return {"total_documents": total, **by_cat}

    def search(self, query: str, top_k: int = 5, category: str | None = None) -> list[dict[str, Any]]:
        """Hybrid Dense Vector Cosine Similarity + Exact Keyword/Acronym/Port Boost RAG Search."""
        q_emb = _tokenize_and_embed(query)
        q_lower = query.lower().strip()
        q_tokens = [t for t in re.sub(r"[^a-z0-9_.\-+]", " ", q_lower).split() if len(t) >= 2]

        sql = "SELECT * FROM rag_documents"
        params: list[Any] = []
        if category:
            sql += " WHERE category = ?"
            params.append(category)

        rows = self._conn.execute(sql, params).fetchall()
        scored: list[dict[str, Any]] = []
        for r in rows:
            doc_emb = json.loads(r["embedding_json"])
            cos_sim = _cosine_similarity(q_emb, doc_emb)
            haystack = f"{r['title']} {r['content']} {r['objective']}".lower()
            kw_boost = 0.0
            for tok in q_tokens:
                if tok in r["title"].lower():
                    kw_boost += 0.28
                elif tok in haystack:
                    kw_boost += 0.12
            score = round(cos_sim + kw_boost, 4)
            scored.append(
                {
                    "doc_id": r["doc_id"],
                    "category": r["category"],
                    "domain": r["domain"],
                    "objective": r["objective"],
                    "title": r["title"],
                    "content": r["content"],
                    "commands": json.loads(r["commands_json"] or "[]"),
                    "source_citation": r["source_citation"],
                    "source_url": r["source_url"],
                    "score": score,
                }
            )

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[: max(1, min(top_k, 20))]

    def teach_topic(self, topic: str) -> dict[str, Any]:
        """Generates a structured Security+ SY0-701 lesson with hands-on commands and cited sources."""
        hits = self.search(topic, top_k=4)
        acronym_match = None
        upper_q = topic.strip().upper()
        if upper_q in SECURITY_PLUS_ACRONYMS:
            acronym_match = {"acronym": upper_q, "expansion": SECURITY_PLUS_ACRONYMS[upper_q]}
        else:
            for k, v in SECURITY_PLUS_ACRONYMS.items():
                if k.lower() in topic.lower().split():
                    acronym_match = {"acronym": k, "expansion": v}
                    break

        citations = []
        commands = []
        sections = []
        for h in hits:
            if h["source_citation"] not in citations:
                citations.append(h["source_citation"])
            for c in h.get("commands", []):
                if c not in commands:
                    commands.append(c)
            sections.append(
                f"### {h['title']} (Domain {h['domain']} | Objective {h['objective']})\n"
                f"{h['content']}\n"
                f"*Citation: {h['source_citation']}*"
            )

        lesson_md = f"## CompTIA Security+ (SY0-701) Deep-Dive: **{topic}**\n\n"
        if acronym_match:
            lesson_md += f"> **Acronym Expansion**: `{acronym_match['acronym']}` = **{acronym_match['expansion']}**\n\n"
        lesson_md += "\n\n".join(sections)
        if commands:
            lesson_md += "\n\n### Hands-On LabEx Commands\n```bash\n" + "\n".join(commands[:8]) + "\n```"

        return {
            "ok": True,
            "exam_code": "SY0-701",
            "topic": topic,
            "acronym_match": acronym_match,
            "lesson_markdown": lesson_md,
            "commands": commands[:8],
            "citations": citations,
            "matches": hits,
        }

    def get_quiz(self, domain: str | None = None, count: int = 3, include_pbq: bool = True) -> dict[str, Any]:
        """Returns practice questions and PBQs with full answer explanations and citations."""
        pool = SECURITY_PLUS_PRACTICE_QUESTIONS
        if domain:
            pool = [q for q in pool if q["domain"].startswith(domain.split(".")[0])]
            if not pool:
                pool = SECURITY_PLUS_PRACTICE_QUESTIONS
        selected = pool[: max(1, min(count, len(pool)))]
        return {
            "ok": True,
            "exam_code": "SY0-701",
            "count": len(selected),
            "questions": selected,
            "pbq": SECURITY_PLUS_PBQ_SCENARIOS[0] if include_pbq else None,
        }

    def explain_command(self, command_str: str) -> dict[str, Any]:
        """Bonus Feature: Breaks down any Linux/Windows security CLI command, flags, SY0-701 objective, and risk level."""
        cmd_clean = command_str.strip()
        parts = cmd_clean.split()
        binary = parts[0].lower() if parts else ""
        if binary == "sudo" and len(parts) > 1:
            binary = parts[1].lower()

        command_catalog: dict[str, dict[str, Any]] = {
            "nmap": {
                "summary": "Network Mapper — active host discovery, port scanning, OS/version fingerprinting, and NSE vulnerability scanning.",
                "objective": "2.3 / 4.3 (Vulnerability Scanning & Reconnaissance)",
                "lab": "LabEx Lab 04: Basic Vulnerability Scanning with Nmap",
                "risk": "MEDIUM (Active probing generates IDS/SIEM alerts; require Rules of Engagement before scanning)",
                "flags": {
                    "-sS": "TCP SYN stealth scan (half-open; does not complete 3-way handshake)",
                    "-sT": "TCP Connect scan (completes full 3-way handshake)",
                    "-sU": "UDP port scan",
                    "-sV": "Probe open ports to determine service/version info",
                    "-O": "Enable OS detection",
                    "-sn": "Ping scan — host discovery only, disable port scan",
                    "--script": "Execute Nmap Scripting Engine (NSE) scripts (e.g., `vuln`)",
                    "-p": "Specify port ranges to scan",
                },
            },
            "openssl": {
                "summary": "Cryptographic toolkit for TLS, X.509 certificates, RSA/ECC key generation, SHA-256 digital signatures, and AES encryption.",
                "objective": "1.4 (Public Key Infrastructure & Cryptographic Solutions)",
                "lab": "LabEx Lab 01 & Lab 06: Ensuring Data Integrity and Authenticity with Cryptography",
                "risk": "SAFE (Cryptographic utility)",
                "flags": {
                    "enc": "Symmetric cipher routine (e.g., `-aes-256-cbc -pbkdf2`)",
                    "dgst": "Message digest & digital signature (`-sha256 -sign` / `-verify`)",
                    "genpkey": "Generate private key (RSA, EC, Ed25519)",
                    "req": "PKCS#10 Certificate Signing Request (CSR) and X.509 generation (`-x509`)",
                },
            },
            "ufw": {
                "summary": "Uncomplicated Firewall — front-end for Linux `iptables`/`nftables` host-based packet filtering.",
                "objective": "2.5 / 4.1 (Endpoint Hardening & Host-Based Firewalls)",
                "lab": "LabEx Lab 10: Hardening a Linux Endpoint with Firewall and Service Management",
                "risk": "MEDIUM (Blocking port 22/SSH remotely without an allow rule can lock out remote administrators)",
                "flags": {
                    "default": "Set default policy (`deny incoming` / `allow outgoing`)",
                    "allow": "Add allow rule for port/protocol (e.g., `22/tcp`)",
                    "deny": "Add explicit deny rule",
                    "enable": "Activate firewall and enable at boot",
                    "status": "Show active firewall rules (`verbose` / `numbered`)",
                },
            },
            "tcpdump": {
                "summary": "Command-line packet analyzer for capturing and inspecting live network traffic or PCAP files.",
                "objective": "4.4 / 4.9 (Network Monitoring & Packet Capture Analysis)",
                "lab": "LabEx Lab 11: Network Traffic Analysis and Secure Remote Access",
                "risk": "LOW (Passive capture, though `-w` on high-throughput links can fill disk if unconstrained)",
                "flags": {
                    "-i": "Specify network interface to listen on (e.g., `eth0`, `any`)",
                    "-nn": "Do not resolve hostnames or port names (faster, numeric IPs/ports)",
                    "-w": "Write raw packets to a `.pcap` file",
                    "-r": "Read packets from a saved `.pcap` file",
                    "-c": "Exit after capturing N packets",
                    "-A": "Print each packet payload in ASCII (useful for cleartext HTTP inspection)",
                },
            },
            "dd": {
                "summary": "Low-level bit-stream data duplicator used in digital forensics to create bit-for-bit raw disk images.",
                "objective": "4.8 (Digital Forensics Evidence Acquisition)",
                "lab": "LabEx Lab 13: Digital Forensics Evidence Acquisition and Integrity",
                "risk": "HIGH / DESTRUCTIVE IF REVERSED (Swapping `if=` and `of=` overwrites the target disk!)",
                "flags": {
                    "if=": "Input file / source block device (e.g., `/dev/sdb`)",
                    "of=": "Output file / forensic raw image destination",
                    "bs=": "Block size (e.g., `4M` for high-speed imaging)",
                    "conv=noerror,sync": "Continue on read errors and pad bad sectors with nulls to preserve forensic offsets",
                },
            },
            "chmod": {
                "summary": "Change POSIX file mode bits (read=4, write=2, execute=1) for owner, group, and others.",
                "objective": "1.2 / 4.6 (Confidentiality & Access Control)",
                "lab": "LabEx Lab 01 & Lab 07: Foundational Security Concepts (CIA Triad)",
                "risk": "MEDIUM (`chmod 777` exposes files to world write/execution; use `600` or `640` for sensitive files)",
                "flags": {
                    "600": "Owner read/write only (`rw-------`) — required for SSH private keys & secrets",
                    "444": "Read-only for all (`r--r--r--`) — used to lock forensic evidence files",
                    "-R": "Apply permissions recursively",
                },
            },
            "docker": {
                "summary": "Container runtime management; security flags enforce isolation, read-only rootfs, and capability dropping.",
                "objective": "3.1 / 4.1 (Container Security & Architecture)",
                "lab": "LabEx Lab 09: Introduction to Container Security with Docker",
                "risk": "LOW (Unless `--privileged` or `-v /:/host` is used, which allows trivial container escape)",
                "flags": {
                    "--read-only": "Mount container root filesystem as read-only",
                    "--cap-drop=ALL": "Drop all Linux kernel capabilities to enforce least privilege",
                    "--security-opt=no-new-privileges:true": "Prevent processes from gaining new privileges via setuid binaries",
                    "-u": "Run container as non-root UID:GID",
                },
            },
        }

        info = command_catalog.get(
            binary,
            {
                "summary": f"Security/System command `{binary}` analyzed against CompTIA Security+ (SY0-701) knowledge base.",
                "objective": "4.1 / 4.4 (Security Operations & Endpoint Administration)",
                "lab": "LabEx CompTIA Security+ Hands-On Training Labs",
                "risk": "HIGH (Destructive flags detected)" if any(x in cmd_clean for x in ["rm -rf", "mkfs", "dd of=/dev/"]) else "LOW",
                "flags": {},
            },
        )

        matched_flags = []
        for token in parts[1:]:
            for flg, desc in info.get("flags", {}).items():
                if token.startswith(flg) or token == flg:
                    matched_flags.append({"flag": token, "meaning": desc})

        rag_hits = self.search(cmd_clean, top_k=2)
        return {
            "ok": True,
            "command": cmd_clean,
            "binary": binary,
            "summary": info["summary"],
            "sy0_701_objective": info["objective"],
            "labex_reference": info["lab"],
            "risk_level": info["risk"],
            "parsed_flags": matched_flags,
            "related_kb": [
                {"title": h["title"], "citation": h["source_citation"]} for h in rag_hits
            ],
        }

    def get_status(self) -> dict[str, Any]:
        counts = self.get_counts()
        labs = parse_cloned_labex_readme()
        return {
            "ok": True,
            "exam": EXAM_METADATA,
            "labex_repo_cloned": (LABEX_REPO_DIR / "README.md").is_file(),
            "labex_repo_path": str(LABEX_REPO_DIR),
            "labex_labs_count": len(labs),
            "objectives_count": len(SY0_701_OBJECTIVES_KB),
            "ports_count": len(SECURITY_PLUS_PORTS),
            "acronyms_count": len(SECURITY_PLUS_ACRONYMS),
            "frameworks_count": len(SECURITY_PLUS_FRAMEWORKS),
            "practice_questions_count": len(SECURITY_PLUS_PRACTICE_QUESTIONS),
            "pbq_scenarios_count": len(SECURITY_PLUS_PBQ_SCENARIOS),
            "rag_db_path": str(self.db_path),
            "rag_counts": counts,
        }


_secplus_instance: SecurityPlusRAG | None = None


def get_secplus_rag() -> SecurityPlusRAG:
    global _secplus_instance
    if _secplus_instance is None:
        _secplus_instance = SecurityPlusRAG()
    return _secplus_instance
