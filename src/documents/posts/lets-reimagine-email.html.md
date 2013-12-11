---
title: Lets reimagine e-mail
date: 2013-11-28
layout: post
hidden: true
---

In the early eighties, Jon Postel first proposed the Simple Mail Transfer 
Protocol to the then nascent Internet community. The proposal defined a way to 
deliver electronic mail within this new global network made of many other 
networks. It did that in part by specifying how e-mail addresses will work - 
the e-mail address format that we all know and love today.

SMTP enabled users of the network to exchange electronic mail. Institutions 
such as universities and companies would run their own server that speaks the 
SMTP protocol. When delivering mail, this server would try to contact the SMTP 
server on the recipient's end and transmit the message.

Lets fast forward to today: We're still using SMTP to deliver e-mail. The 
contents of an e-mail can contain complex data such as attachments. Email works
for everyone, everywhere - anyone can host their own email server.

But SMTP is still essentially used for the same thing: electronic mail. Most 
people use one e-mail address for everything, and complain that they're 
receiving lots of spam and irrelevant noise. 


## HTTP, HTML and WWW

In the early nineties, Tim Berners-Lee and his team proposed the HyperText 
Markup Language and the HyperText Transfer protocol. The main idea was to allow 
users to write and publish rich documents which can easily reference each-other 
across all connected machines, using hyperlinks.

The protocol enabled linking documents to other documents by proposing a format
for URLs, the Uniform Resource Locator. Like e-mail addresses can identify a
recipient, URLs could identify hypertext documents as well tell us the means to 
get that document. The URL http://www.google.com/ tells the browser: Using the 
HTTP protocol, connect to the domain www.google.com and fetch the default 
(index) document.

Fast forward to today: We're using HTML for everything. A hyperlink could lead 
you to a simple rich document, but also to [games][unreal], [messaging 
services][twitter], [real time collaborative document editors][google-docs], 
[other collaboration platforms][github] and so on. 

But there is almost zero cross-service communication between users. In most
cases users must register accounts on each website where they want to 
participate.

[unreal]: http://www.unrealengine.com/html5/
[twitter]: http://twitter.com
[google-docs]: https://drive.google.com/
[github]: https://github.com

## Strength and weakness

Did you notice something strange about this history? Two protocols, two 
systems, both introducing similar ideas and working in similar ways, but both 
having different failings.

Why are we still stuck with the same capabilities of e-mail? Why are we not 
building amazing messaging and collaboration tools on top of it? Why are most 
existing websites walled-gardens that don't allow communication with users of
other websites or users that don't have an account?

Lets try to figure out the answers.

With HTTP, we can distribute both the content and the application that consumes 
that content. However, we're unable to easily send that content to other 
servers. As a result, users must create accounts on each website and keep all 
their data stored on the website's servers. The ability to add external user 
participation is extremely limited.

This in turn means that people and companies wont be willing to use web-based 
services for some of their more sensitive data. It also means that the data 
formats used by our web application are somewhat proprietary and cannot be 
easily communicated with other, competing services.

With SMTP, the situation is the exact opposite. We can easily distribute 
content to other servers. We can extend the protocol in backward-compatible 
ways using custom headers and by adding meta-data to the messages. However, we 
cant extend the consumer of that data - the e-mail client. 

Which means we're still stuck with plain old e-mail.

## What DoxBee needs

Our document collaboration platform [DoxBee][doxbee] needs both things. We want 
easy communication and sharing between the users of our service. We also want 
our users to be able to collaborate with e-mail users, without forcing e-mail 
users to use DoxBee. Finally, we'd like to be able to offer dedicated DoxBee 
software for companies, which would enable them to host their own data and 
messages on their own servers, while still being able to communicate with the 
central cloud as well as other DoxBee servers.

Additionally, we also want to offer different functionality: not e-mail, but 
document collaboration. Sending and receiving messages is only part of it. 
There is also:

* document version exchange
* preview, diff, "blame" and commenting tools
* the ability to accept, reject or merge versions coming from others
* file synchronization across machines
* grouping all versions and related discussions of a document together

## The idea

We decided to try something a bit radical - combine the strengths of both 
e-mail and web. Why use e-mail addresses and SMTP just for e-mail?

We're rejecting the common idea of a single e-mail address as a personal 
identifier, used for everything. Instead we're trying to encourage the use of
multiple e-mail addresses for multiple purposes. 

As a DoxBee user, you will get a new e-mail address. You will use it to 
collaborate on documents by sending and receiving new versions. Because it uses 
SMTP at its core, DoxBee is be able to work transparently to other users that
are using regular e-mail clients. They will receive a classic e-mail message 
with the document attached to it, and they will be able to reply to them with 
comments or version updates.

However, this outgoing message will be extended with extra unobtrusive metadata. 
This metadata will help an intelligent client, delivered via HTTP/HTML to the
browser. With it, the client is able to organize messages according to their
related document versions and document versions according to their related
document files, in essence building a distributed version control system with
messaging capabilities.

On top of this basic functionality, the smart client can provide nice 
cross-platform addon tools for many document types: document preview tools, 
diffs, commenting tools, digital signing, quick editing and perhaps even merge 
tools for office documents.

Desktop versions of the client will also be able to launch the original desktop 
tools and improve your workflow tremendously. Here is how that would look like:

You're editing a document in Word when suddenly a notification pops up. Your 
coworker sent you a new version of the same document. You save your own changes, 
then proceed by choosing "Merge" from the notification. This will launch 
[Word's own native 3-way merge tool][word-merge] which will allow you to merge 
the changes perfectly and continue working on your own part.

No locking - work can be done in parallel. No overriding edits, changes can be 
merged instead. Everyone has their own copy and can't destroy someone else's 
version. Compatible with e-mail. 

What more would you need? 

It turns out, a lot more.

[word-merge]: http://support.microsoft.com/kb/306484

## The extendible BrowserMailclient.

We've already solved this problem for [DoxBee][doxbee]. Is this really enough? 
Most e-mail clients wont be able to provide rich functionality to the user. 

But what if each e-mail message included simple headers such as this one?

```
X-Client-Extension: DoxBee (http://doxbee.com/)
```

Imagine that. You would be able to distribute a reference to your application 
together with the SMTP message. The client will fetch this HTML-based 
application via HTTP, then process the message with it like a browser would.

This new kind of mail client could provide APIs to enable rich communication
applications. It could also treat local, "tainted" data differently, same as 
the way browsers treat data fetched by doing cross-origin requests. It would 
combine the rich extensibility of browsers with the powerful standardized 
messaging capabilities of e-mail. Finally, it could be designed in a backward 
compatible way, with existing clients getting limited but nevertheless usable
experience.

Message boards. Facebook. Twitter. Forums. Mailing lists and groups. 
Interactive maps.

The possibilities are endless.

## The implementation

Lets look at a couple of case studies where this feature will be useful

1. An executive that can click "Approve this" directly from his e-mail. This
will add his approval to the business management software, as well as perhaps
deliver an appropriate e-mail to the next in the chain.

2. A smartmail-compatible server intercepts the doxbee extension. It has a
local extension server to handle DoxBee-extended messages, so it forwards the 
message to it for processing. The DoxBee-extension server processes the message 
and stores the contained documents and attachments in the version control 
system. Then it delivers the message back to the server. When this message is
delivered to the client, they should be able to open it with the doxbee 
extension server, not the original doxbee.com


[doxbee]: http://doxbee.com
