**TRUEUP MEDIA**

Content Management & Scheduling Platform

**SOFTWARE REQUIREMENTS SPECIFICATION (SRS)**

**Schedule Tracker Module --- Phase 1**

Admin & General Manager Access

  ---------------------------- ------------------------------------------
  **Document Version**         1.0

  **Date**                     April 22, 2026

  **Status**                   Draft

  **Prepared For**             TrueUp Media Pvt. Ltd.

  **Module**                   Schedule Tracker (Phase 1)
  ---------------------------- ------------------------------------------

**1. Introduction**

**1.1 Purpose**

This Software Requirements Specification (SRS) defines the functional
and non-functional requirements for the TrueUp Media Schedule Tracker
web application --- Phase 1. This phase covers the Admin and General
Manager roles only. The document serves as the reference agreement
between stakeholders and the development team.

**1.2 Project Overview**

TrueUp Media is a B2B content management company that creates Posters
(static social media posts) and Reels (short-form video content) to
advertise its client companies. Managing multiple clients, content
pipelines, and team assignments requires a centralized scheduling
platform.

The Schedule Tracker web application fulfills this need by providing:

-   A client management interface for the Admin to onboard and offboard
    clients.

-   A per-client calendar for the General Manager to schedule content
    deliverables.

-   A company-wide master calendar to provide a holistic view across all
    clients.

-   Status tracking for each content piece through its production
    lifecycle.

-   Task assignment capabilities to Team Leads (TL1 and TL2) --- scoped
    for Phase 2).

**1.3 Scope**

Phase 1 of the Schedule Tracker includes:

-   Role-based access for Admin and General Manager.

-   Client CRUD (Create, Read, Update, Delete) functionality for Admin.

-   Monthly calendar views --- per-client and company-wide --- managed
    by the General Manager.

-   Content type support: Posts and Reels.

-   Status workflow management for Posts and Reels.

Out of scope for Phase 1 (deferred to later phases):

-   Team Lead 1 (TL1), Team Lead 2 (TL2), and COO roles.

-   Task assignment and notification to team leads.

-   Reporting and analytics dashboards.

-   Mobile application.

**1.4 Definitions, Acronyms, and Abbreviations**

  -----------------------------------------------------------------------
  **Term / Acronym** **Definition**
  ------------------ ----------------------------------------------------
  SRS                Software Requirements Specification

  Admin              System Administrator --- highest privilege role in
                     Phase 1

  GM                 General Manager --- responsible for scheduling and
                     status management

  TL1 / TL2          Team Lead 1 / Team Lead 2 --- out of scope for Phase
                     1

  COO                Chief Operating Officer --- out of scope for Phase 1

  Post               A static image-based social media deliverable (also
                     called Poster)

  Reel               A short-form video content deliverable

  Client Calendar    A monthly calendar dedicated to a single client\'s
                     content schedule

  Master Calendar    A company-wide monthly calendar showing all
                     clients\' content

  RBAC               Role-Based Access Control

  CRUD               Create, Read, Update, Delete operations

  B2B                Business-to-Business --- TrueUp Media\'s service
                     model
  -----------------------------------------------------------------------

**1.5 Document Conventions**

-   Requirements are labeled FR (Functional Requirement) or NFR
    (Non-Functional Requirement).

-   Each requirement carries a unique ID, e.g., FR-ADM-001.

-   Priority levels: High / Medium / Low.

**2. Overall Description**

**2.1 Product Perspective**

The Schedule Tracker is a standalone, web-based application built
exclusively for TrueUp Media\'s internal operations. It is not a
public-facing SaaS product. The system communicates with a backend API
and a relational database to persist client data, calendar events, and
user records.

**2.2 User Classes and Characteristics**

  -------------------------------------------------------------------------
  **Role**      **Access        **Primary Responsibilities**   **Phase**
                Level**                                        
  ------------- --------------- ------------------------------ ------------
  Admin         Full system     Manage clients, manage users,  Phase 1
                access          oversee system                 

  General       Scheduling &    Schedule content on calendars, Phase 1
  Manager (GM)  status          update statuses, assign tasks  

  Team Lead 1   Task execution  View assigned tasks, update    Phase 2
  (TL1)                         progress (Posts)               

  Team Lead 2   Task execution  View assigned tasks, update    Phase 2
  (TL2)                         progress (Reels)               

  COO           Read-only /     Monitor company-wide calendar  Phase 2
                oversight       and progress                   
  -------------------------------------------------------------------------

**2.3 Operating Environment**

-   Web application accessible via modern browsers (Chrome 100+, Firefox
    100+, Edge 100+, Safari 15+).

-   Responsive design supporting desktop screens (minimum 1280px width
    recommended).

-   Hosted on cloud infrastructure (specific provider to be determined
    during architecture phase).

-   Authentication via secure session-based or JWT-based mechanism.

**2.4 Assumptions and Dependencies**

-   Each user is provisioned by the Admin before first login.

-   The system will be accessed over a secure HTTPS connection.

-   Client details are assumed to be unique per company name.

-   A calendar month spans a standard Gregorian calendar month.

-   Content types are limited to Posts and Reels in Phase 1; additional
    types may be added later.

**3. System Features & Functional Requirements**

**3.1 Authentication & Authorization**

**3.1.1 User Login**

  -----------------------------------------------------------------------------
  **Req. ID**   **Description**                                  **Priority**
  ------------- ------------------------------------------------ --------------
  FR-AUTH-001   The system shall provide a login page with       High
                username/email and password fields.              

  FR-AUTH-002   The system shall authenticate users against      High
                stored credentials.                              

  FR-AUTH-003   The system shall display an appropriate error    High
                message for invalid credentials.                 

  FR-AUTH-004   The system shall enforce role-based access       High
                control (RBAC) upon successful login.            

  FR-AUTH-005   The system shall redirect the Admin to the Admin High
                Dashboard upon login.                            

  FR-AUTH-006   The system shall redirect the General Manager to High
                the Scheduling Dashboard upon login.             

  FR-AUTH-007   The system shall provide a secure logout         High
                mechanism that invalidates the session.          

  FR-AUTH-008   The system shall lock an account after 5         Medium
                consecutive failed login attempts.               
  -----------------------------------------------------------------------------

**3.2 Admin --- Client Management**

**3.2.1 Add Client**

The Admin shall be able to add new client companies to the system.

  ----------------------------------------------------------------------------
  **Req. ID**  **Description**                                  **Priority**
  ------------ ------------------------------------------------ --------------
  FR-ADM-001   The system shall provide a form for the Admin to High
               add a new client.                                

  FR-ADM-002   The client form shall capture: Company Name,     High
               Phone Number, Email Address, and Physical        
               Address.                                         

  FR-ADM-003   Company Name shall be a mandatory, unique field. High

  FR-ADM-004   Email shall be validated against standard email  High
               format.                                          

  FR-ADM-005   Phone Number shall be validated for numeric      Medium
               format (10--15 digits, supporting country        
               codes).                                          

  FR-ADM-006   On successful addition, the new client shall     High
               appear in the client list immediately.           

  FR-ADM-007   The system shall display a success notification  Medium
               upon client addition.                            

  FR-ADM-008   The system shall prevent duplicate company names High
               (case-insensitive check).                        
  ----------------------------------------------------------------------------

**3.2.2 View / Search Clients**

  ----------------------------------------------------------------------------
  **Req. ID**  **Description**                                  **Priority**
  ------------ ------------------------------------------------ --------------
  FR-ADM-009   The system shall display all clients in a        High
               tabular list showing: Company Name, Email,       
               Phone, Address, and Date Added.                  

  FR-ADM-010   The Admin shall be able to search clients by     High
               Company Name.                                    

  FR-ADM-011   The Admin shall be able to view the full details High
               of any client by clicking on the client record.  
  ----------------------------------------------------------------------------

**3.2.3 Edit Client**

  ----------------------------------------------------------------------------
  **Req. ID**  **Description**                                  **Priority**
  ------------ ------------------------------------------------ --------------
  FR-ADM-012   The Admin shall be able to edit any client\'s    High
               details (Company Name, Phone, Email, Address).   

  FR-ADM-013   Editing shall apply the same validation rules as High
               client creation.                                 

  FR-ADM-014   The system shall display a success notification  Medium
               after a successful edit.                         
  ----------------------------------------------------------------------------

**3.2.4 Delete Client**

  ----------------------------------------------------------------------------
  **Req. ID**  **Description**                                  **Priority**
  ------------ ------------------------------------------------ --------------
  FR-ADM-015   The Admin shall be able to delete a client from  High
               the system.                                      

  FR-ADM-016   The system shall prompt a confirmation dialog    High
               before deletion: \'Are you sure you want to      
               remove \[Client Name\]? This will delete all     
               associated calendar data.\'                      

  FR-ADM-017   Upon confirmation, the client and all associated High
               calendar entries shall be permanently removed.   

  FR-ADM-018   The Admin shall be able to cancel the deletion   High
               via the confirmation dialog.                     
  ----------------------------------------------------------------------------

**3.3 General Manager --- Client Calendar**

**3.3.1 Calendar Overview**

The per-client calendar is a monthly view dedicated to a single client.
It shows scheduled Posts and Reels on their respective dates, mimicking
the layout shown in the reference screenshot --- dates displayed in a
7-column (Mon--Sun) grid with colored content labels.

  ----------------------------------------------------------------------------
  **Req. ID**  **Description**                                  **Priority**
  ------------ ------------------------------------------------ --------------
  FR-CAL-001   The system shall provide a per-client monthly    High
               calendar view accessible to the General Manager. 

  FR-CAL-002   The calendar shall display all 7 days of the     High
               week (Monday through Sunday) as columns.         

  FR-CAL-003   The GM shall be able to navigate between months  High
               using Previous/Next controls.                    

  FR-CAL-004   The current month and year shall be prominently  High
               displayed above the calendar grid.               

  FR-CAL-005   Each calendar day cell shall display any         High
               scheduled Posts and Reels for that date.         

  FR-CAL-006   Posts and Reels shall be visually distinguished  High
               using different colors or labels (e.g., orange   
               for Reel, amber for Post as per reference).      

  FR-CAL-007   The GM shall be able to select a client from a   High
               dropdown or sidebar to load that client\'s       
               calendar.                                        
  ----------------------------------------------------------------------------

**3.3.2 Scheduling Content on Client Calendar**

  ----------------------------------------------------------------------------
  **Req. ID**  **Description**                                  **Priority**
  ------------ ------------------------------------------------ --------------
  FR-CAL-008   The GM shall be able to click on any date cell   High
               to add a new content item.                       

  FR-CAL-009   The add-content form shall allow the GM to       High
               select Content Type: Post or Reel.               

  FR-CAL-010   The add-content form shall pre-populate the      Medium
               selected date.                                   

  FR-CAL-011   The GM shall be able to add multiple content     High
               items to the same date.                          

  FR-CAL-012   The GM shall be able to edit a scheduled content High
               item (date, type, status).                       

  FR-CAL-013   The GM shall be able to delete a scheduled       High
               content item with a confirmation prompt.         
  ----------------------------------------------------------------------------

**3.4 Content Status Workflows**

**3.4.1 Reel Status Workflow**

The following statuses apply to all Reel content items in sequential
order:

  ---------------------------------------------------------------------------
  **Step**   **Status**          **Description**
  ---------- ------------------- --------------------------------------------
  1          CONTENT READY       Script or creative brief has been finalized
                                 and is ready for shoot.

  2          SHOOT DONE          Filming/recording of the reel has been
                                 completed.

  3          EDITING IN PROGRESS Video editing is currently underway.

  4          EDITED              Editing is complete; reel is ready for
                                 internal review.

  5          WAITING FOR         Reel has been submitted to the client for
             APPROVAL            approval.

  6          APPROVED            Client has approved the reel.

  7          POSTED              Reel has been published on the client\'s
                                 social media platform.
  ---------------------------------------------------------------------------

**3.4.2 Post (Poster) Status Workflow**

The following statuses apply to all Post content items in sequential
order:

  ---------------------------------------------------------------------------
  **Step**   **Status**          **Description**
  ---------- ------------------- --------------------------------------------
  1          CONTENT APPROVED    The copy/text content has been approved and
                                 is ready for design.

  2          DESIGNING IN        Graphic design for the post is currently
             PROGRESS            underway.

  3          DESIGNING COMPLETED Design is finalized; post is ready for
                                 internal review.

  4          WAITING FOR         Post has been submitted to the client for
             APPROVAL            approval.

  5          APPROVED            Client has approved the post; ready for
                                 publishing.
  ---------------------------------------------------------------------------

**3.4.3 Status Management Requirements**

  ----------------------------------------------------------------------------
  **Req. ID**  **Description**                                  **Priority**
  ------------ ------------------------------------------------ --------------
  FR-STA-001   Each content item (Post or Reel) shall have      High
               exactly one status at any time.                  

  FR-STA-002   The GM shall be able to update the status of any High
               content item on either calendar.                 

  FR-STA-003   Status transitions shall follow the defined      Medium
               sequential workflow (no skipping steps).         

  FR-STA-004   The current status of each content item shall be High
               visible directly on the calendar cell (e.g., as  
               a colored badge or tooltip).                     

  FR-STA-005   A status history log shall be maintained for     Medium
               each content item (timestamp, changed by, old    
               status, new status).                             
  ----------------------------------------------------------------------------

**3.5 General Manager --- Master (Company-Wide) Calendar**

**3.5.1 Master Calendar Overview**

The master calendar is a company-wide monthly view. Unlike the
per-client calendar which shows one client\'s schedule, the master
calendar aggregates all clients\' Posts and Reels onto a single calendar
to give the General Manager a holistic view of workload and deadlines.

  ----------------------------------------------------------------------------
  **Req. ID**  **Description**                                  **Priority**
  ------------ ------------------------------------------------ --------------
  FR-MCA-001   The system shall provide a master monthly        High
               calendar view accessible to the GM and Admin.    

  FR-MCA-002   The master calendar shall display Posts and      High
               Reels for all active clients on their respective 
               scheduled dates.                                 

  FR-MCA-003   Each content item on the master calendar shall   High
               display the client name alongside the content    
               type.                                            

  FR-MCA-004   The GM shall be able to navigate the master      High
               calendar between months using Previous/Next      
               controls.                                        

  FR-MCA-005   The master calendar shall use color coding or    High
               labels to distinguish between Posts and Reels.   

  FR-MCA-006   The GM shall be able to click on any content     High
               item in the master calendar to view its full     
               details (client, type, status, assigned TL).     

  FR-MCA-007   The master calendar shall support a filter to    Medium
               show content for specific clients only.          

  FR-MCA-008   The master calendar shall support a filter to    Medium
               show specific content types (Posts only / Reels  
               only / Both).                                    
  ----------------------------------------------------------------------------

**3.6 Admin Dashboard**

  -----------------------------------------------------------------------------
  **Req. ID**   **Description**                                  **Priority**
  ------------- ------------------------------------------------ --------------
  FR-ADSH-001   The Admin shall have access to a dashboard       Medium
                showing: total active clients, total content     
                items scheduled this month, and a summary of     
                content by status.                               

  FR-ADSH-002   The Admin dashboard shall provide quick          High
                navigation to: Client Management, Master         
                Calendar, and User Management (Phase 2).         

  FR-ADSH-003   The Admin shall be able to view the master       High
                calendar in read mode.                           
  -----------------------------------------------------------------------------

**4. Non-Functional Requirements**

**4.1 Performance**

  ------------------------------------------------------------------------
  **Req. ID**    **Description**                          **Target**
  -------------- ---------------------------------------- ----------------
  NFR-PERF-001   Calendar page load time (per-client and  \< 2 seconds
                 master)                                  

  NFR-PERF-002   Client list load time (up to 200         \< 1.5 seconds
                 clients)                                 

  NFR-PERF-003   Status update response time              \< 1 second

  NFR-PERF-004   Concurrent user support without          \>= 20 users
                 degradation                              
  ------------------------------------------------------------------------

**4.2 Security**

  -----------------------------------------------------------------------------
  **Req. ID**   **Description**                                  **Priority**
  ------------- ------------------------------------------------ --------------
  NFR-SEC-001   All data transmissions shall be encrypted using  High
                HTTPS/TLS 1.2 or higher.                         

  NFR-SEC-002   Passwords shall be hashed using a secure hashing High
                algorithm (bcrypt or Argon2).                    

  NFR-SEC-003   Role-based access control shall prevent          High
                unauthorized access to restricted features.      

  NFR-SEC-004   Session tokens shall expire after 8 hours of     Medium
                inactivity.                                      

  NFR-SEC-005   The system shall log all Admin actions (client   Medium
                add, edit, delete) with timestamp and user ID.   
  -----------------------------------------------------------------------------

**4.3 Usability**

  -----------------------------------------------------------------------------
  **Req. ID**   **Description**                                  **Priority**
  ------------- ------------------------------------------------ --------------
  NFR-USE-001   The calendar UI shall follow an intuitive        High
                month-grid layout consistent with the provided   
                wireframe reference.                             

  NFR-USE-002   All forms shall provide real-time inline         High
                validation with clear error messages.            

  NFR-USE-003   All destructive actions (delete client, delete   High
                content item) shall require a confirmation       
                dialog.                                          

  NFR-USE-004   The application shall provide visual feedback    Medium
                (loading spinners, success/error toasts) for all 
                async operations.                                
  -----------------------------------------------------------------------------

**4.4 Reliability & Availability**

  -----------------------------------------------------------------------
  **Req. ID**   **Description**                          **Target**
  ------------- ---------------------------------------- ----------------
  NFR-REL-001   System uptime                            \>= 99.5% per
                                                         month

  NFR-REL-002   Data backup frequency                    Daily automated
                                                         backups

  NFR-REL-003   Recovery Time Objective (RTO)            \< 4 hours
  -----------------------------------------------------------------------

**4.5 Maintainability**

-   The codebase shall follow standard component-based architecture.

-   API endpoints shall be documented using OpenAPI/Swagger
    specification.

-   The database schema shall support easy addition of new roles and
    content types in future phases.

**5. System Architecture Overview**

**5.1 Architecture Layers**

  ------------------------------------------------------------------------
  **Layer**          **Technology             **Responsibility**
                     (Recommended)**          
  ------------------ ------------------------ ----------------------------
  Frontend (UI)      React.js / Next.js       Render calendar views,
                                              forms, dashboards

  Backend (API)      Node.js + Express /      Business logic, RBAC, data
                     Django REST              access layer

  Database           PostgreSQL               Persist users, clients,
                                              calendar events, statuses

  Authentication     JWT / Secure Sessions    Token issuance, session
                                              management

  Hosting            AWS / Azure / GCP (TBD)  Deployment, scaling, backup
  ------------------------------------------------------------------------

**5.2 Key Entities (Data Model Overview)**

  -----------------------------------------------------------------------
  **Entity**       **Key Attributes**
  ---------------- ------------------------------------------------------
  User             user_id, name, email, password_hash, role (Admin \| GM
                   \| TL1 \| TL2 \| COO), created_at

  Client           client_id, company_name, phone, email, address,
                   created_by (Admin), created_at, is_active

  ContentItem      item_id, client_id, content_type (Post \| Reel),
                   scheduled_date, status, created_by, updated_at

  StatusLog        log_id, item_id, old_status, new_status, changed_by,
                   changed_at
  -----------------------------------------------------------------------

**6. Use Case Summary**

**6.1 Admin Use Cases**

  -----------------------------------------------------------------------
  **Use Case **Use Case Name** **Primary   **Brief Description**
  ID**                         Actor**     
  ---------- ----------------- ----------- ------------------------------
  UC-001     Login to System   Admin       Admin enters credentials and
                                           gains access to the Admin
                                           Dashboard.

  UC-002     Add New Client    Admin       Admin fills in client details
                                           and submits the form to
                                           register a new client.

  UC-003     View Client List  Admin       Admin views all registered
                                           clients in a searchable list.

  UC-004     Edit Client       Admin       Admin selects a client and
             Details                       modifies their information.

  UC-005     Delete Client     Admin       Admin removes a client and all
                                           associated calendar data after
                                           confirmation.

  UC-006     View Master       Admin       Admin views the company-wide
             Calendar                      calendar in read mode.
  -----------------------------------------------------------------------

**6.2 General Manager Use Cases**

  -----------------------------------------------------------------------
  **Use Case **Use Case Name** **Primary   **Brief Description**
  ID**                         Actor**     
  ---------- ----------------- ----------- ------------------------------
  UC-007     Login to System   GM          GM enters credentials and
                                           gains access to the Scheduling
                                           Dashboard.

  UC-008     Open Client       GM          GM selects a client to view
             Calendar                      their dedicated monthly
                                           calendar.

  UC-009     Schedule Content  GM          GM clicks a date and adds a
             Item                          Post or Reel with initial
                                           status.

  UC-010     Edit Content Item GM          GM edits a scheduled item\'s
                                           date, type, or status.

  UC-011     Delete Content    GM          GM removes a scheduled item
             Item                          after confirmation.

  UC-012     Update Content    GM          GM advances a content item\'s
             Status                        status to the next stage.

  UC-013     View Master       GM          GM views the aggregated
             Calendar                      calendar across all clients.

  UC-014     Filter Master     GM          GM filters the master calendar
             Calendar                      by client or content type.
  -----------------------------------------------------------------------

**7. Constraints & Limitations**

-   Phase 1 is strictly limited to Admin and General Manager roles. TL1,
    TL2, and COO roles will be implemented in Phase 2.

-   Task assignment to Team Leads is not functional in Phase 1; the GM
    can view TL assignment fields but cannot save them until Phase 2.

-   Mobile responsiveness is a Phase 2 concern; Phase 1 targets desktop
    browsers.

-   The system does not integrate with any external social media
    publishing platforms in Phase 1.

-   There is no built-in notification or email alerting system in Phase
    1.

**8. Future Enhancements (Phase 2+)**

  -----------------------------------------------------------------------
  **Enhancement**       **Description**                       **Phase**
  --------------------- ------------------------------------- -----------
  TL1 & TL2 Role Access Grant Team Leads the ability to view  Phase 2
                        tasks assigned by the GM and update   
                        statuses.                             

  COO Role Access       Read-only overview access to          Phase 2
                        company-wide calendar and progress.   

  Task Assignment       GM can assign specific Reels to TL2   Phase 2
                        and Posts to TL1 with deadlines.      

  Notifications         In-app and email notifications for    Phase 2
                        status changes and upcoming           
                        deadlines.                            

  Analytics Dashboard   Reports on content volume, status     Phase 3
                        bottlenecks, and client activity.     

  Social Media          Direct publishing from the platform   Phase 3
  Integration           to Instagram, Facebook, etc.          

  Mobile App            Native iOS/Android companion app for  Phase 3
                        on-the-go calendar access.            

  File Attachments      Attach design files or video assets   Phase 2
                        directly to a content item.           
  -----------------------------------------------------------------------

**9. Document Approval**

This document is pending review and sign-off by the following
stakeholders:

  ------------------------------------------------------------------------
  **Name**            **Role**           **Signature**         **Date**
  ------------------- ------------------ --------------------- -----------
                      Admin / Project                          
                      Owner                                    

                      General Manager                          

                      Lead Developer                           

                      COO                                      
  ------------------------------------------------------------------------

**End of Document**
