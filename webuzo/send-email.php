<?php
// Minimal PHP endpoint for Webuzo/cPanel hosting to send SMTP mail via PHPMailer.
// Requirements:
//   composer require phpmailer/phpmailer
// Deploy path suggestion: /public_html/api/send-email.php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method Not Allowed']);
  exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid JSON']);
  exit;
}

$to = $payload['to'] ?? '';
$subject = $payload['subject'] ?? '';
$text = $payload['text'] ?? '';
$html = $payload['html'] ?? '';

if (!$to || !$subject) {
  http_response_code(400);
  echo json_encode(['error' => "Missing 'to' or 'subject'"]);
  exit;
}

// Read SMTP creds from environment or hard-code here.
$smtpHost = getenv('SMTP_HOST') ?: 'mail.sabarisastha.org';
$smtpUser = getenv('SMTP_USER') ?: 'no-reply@sabarisastha.org';
$smtpPass = getenv('SMTP_PASS') ?: '';
$smtpPort = intval(getenv('SMTP_PORT') ?: '465');
$smtpSecure = strtolower(getenv('SMTP_SECURE') ?: 'true') === 'true';
$fromEmail = getenv('FROM_EMAIL') ?: $smtpUser;
$fromName = getenv('FROM_NAME') ?: 'Sabari Sastha Seva Samithi';
$bcc = getenv('SMTP_BCC') ?: '';

require_once __DIR__ . '/vendor/autoload.php';

try {
  $mailer = new PHPMailer(true);
  $mailer->isSMTP();
  $mailer->Host = $smtpHost;
  $mailer->SMTPAuth = true;
  $mailer->Username = $smtpUser;
  $mailer->Password = $smtpPass;
  $mailer->Port = $smtpPort;
  if ($smtpSecure) {
    $mailer->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // 465
  } else {
    $mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // 587
  }
  $mailer->setFrom($fromEmail, $fromName);
  if (is_array($to)) {
    foreach ($to as $addr) { $mailer->addAddress($addr); }
  } else {
    $mailer->addAddress($to);
  }
  if (!empty($bcc)) { $mailer->addBCC($bcc); }
  $mailer->Subject = $subject;
  if (!empty($html)) {
    $mailer->isHTML(true);
    $mailer->Body = $html;
    $mailer->AltBody = $text ?: strip_tags($html);
  } else {
    $mailer->Body = $text;
  }
  $mailer->send();
  echo json_encode(['ok' => true]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}



