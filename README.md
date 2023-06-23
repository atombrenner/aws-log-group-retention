# AWS Log Group Retention

Sets the retention policy of AWS Cloudwatch Log Groups.
Also deletes the corresponding log streams that are older than the retention policy.

## Usage

Edit the retention policy inside the code and run `npm start`

## Caveats

The Cloudwatch API throttles very early.
In my experience, if you do more than 1 request per second
you end up having throttling errors.
That means that cleaning up hundreds of thousands of logstreams
takes a very long time.
