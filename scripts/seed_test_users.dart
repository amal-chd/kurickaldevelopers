// ignore_for_file: avoid_print
import 'dart:convert';
import 'package:http/http.dart' as http;

const String apiKey = "AIzaSyA9ZmA9yNSEcrqgGjxReM_-bF3t15Q0Gk8";
const String projectId = "kurikal-tms-app";

final List<Map<String, String>> targetUsers = [
  {
    "name": "Thomas",
    "email": "thomas@kurickaldevelopers.com",
    "pass": "Kurickal@2024",
    "roleId": "director",
  },
  {
    "name": "Ravi",
    "email": "ravi@kurickaldevelopers.com",
    "pass": "Kurickal@2024",
    "roleId": "project_manager",
  },
  {
    "name": "Arjun",
    "email": "arjun@kurickaldevelopers.com",
    "pass": "Kurickal@2024",
    "roleId": "site_engineer",
  },
  {
    "name": "Priya",
    "email": "priya@kurickaldevelopers.com",
    "pass": "Kurickal@2024",
    "roleId": "site_engineer",
  },
  {
    "name": "Suresh",
    "email": "suresh@kurickaldevelopers.com",
    "pass": "Kurickal@2024",
    "roleId": "foreman",
  },
  {
    "name": "Biju",
    "email": "biju@kurickaldevelopers.com",
    "pass": "Kurickal@2024",
    "roleId": "labour",
  },
  {
    "name": "Meena",
    "email": "meena@kurickaldevelopers.com",
    "pass": "Kurickal@2024",
    "roleId": "admin",
  },
  {
    "name": "Anitha",
    "email": "anitha@kurickaldevelopers.com",
    "pass": "Kurickal@2024",
    "roleId": "accounts",
  },
];

Future<void> main() async {
  for (final user in targetUsers) {
    print('Processing ${user['email']}...');

    // 1. Create/Login Auth User
    String? uid;
    String? idToken;

    var signUpRes = await http.post(
      Uri.parse(
        'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$apiKey',
      ),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "email": user['email'],
        "password": user['pass'],
        "returnSecureToken": true,
      }),
    );

    var authData = jsonDecode(signUpRes.body);

    if (authData['error'] != null &&
        authData['error']['message'] != "EMAIL_EXISTS") {
      print("Auth Error: ${authData['error']}");
      continue;
    }

    uid = authData['localId'];
    idToken = authData['idToken'];

    if (authData['error'] != null &&
        authData['error']['message'] == "EMAIL_EXISTS") {
      var loginRes = await http.post(
        Uri.parse(
          'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey',
        ),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "email": user['email'],
          "password": user['pass'],
          "returnSecureToken": true,
        }),
      );
      var loginData = jsonDecode(loginRes.body);
      uid = loginData['localId'];
      idToken = loginData['idToken'];
    }

    if (uid == null || idToken == null) {
      print("Failed to get UID or idToken");
      continue;
    }

    print("Auth user UID for ${user['email']}: $uid");

    // 2. Create User Document
    final userPayload = {
      "fields": {
        "name": {"stringValue": user['name']},
        "email": {"stringValue": user['email']},
        "phone": {"stringValue": "+910000000000"},
        "roleId": {"stringValue": user['roleId']},
        "isActive": {"booleanValue": true},
        "biometricEnabled": {"booleanValue": false},
        "createdAt": {
          "integerValue": DateTime.now().millisecondsSinceEpoch.toString(),
        },
        "lastLoginAt": {
          "integerValue": DateTime.now().millisecondsSinceEpoch.toString(),
        },
      },
    };

    var dbRes = await http.patch(
      Uri.parse(
        'https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/users/$uid',
      ),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $idToken",
      },
      body: jsonEncode(userPayload),
    );

    if (dbRes.statusCode >= 200 && dbRes.statusCode < 300) {
      print("Seeded user document for ${user['email']}");
    } else {
      print("User DB Error: ${dbRes.body}");
    }
  }
  print("Testing users seeded successfully.");
}
